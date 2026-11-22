class Game < ApplicationRecord
  include SafeUrlValidation

  PHASES = %w[pool playoff fatherson exhibition].freeze
  STATUSES = %w[scheduled live final delayed postponed cancelled].freeze
  BRACKET_ROUNDS = %w[play_in round_of_16 quarterfinal semifinal final third_place].freeze
  NEXT_GAME_SLOTS = %w[home away].freeze
  MUTATION_ID_FORMAT = /\A[a-zA-Z0-9_-]{8,64}\z/
  MAX_BRACKET_DEPTH = 8

  belongs_to :tournament
  belongs_to :division_record, class_name: "Division", foreign_key: :division_id, optional: true, inverse_of: false
  belongs_to :home_team, class_name: "Team", inverse_of: :home_games
  belongs_to :away_team, class_name: "Team", inverse_of: :away_games
  belongs_to :next_game, class_name: "Game", optional: true
  belongs_to :score_updated_by, class_name: "User", optional: true

  has_many :feeder_games, class_name: "Game", foreign_key: :next_game_id
  has_many :article_links, dependent: :nullify
  has_many :media_assets, dependent: :nullify
  has_many :prediction_polls, dependent: :destroy

  before_validation :infer_phase_from_legacy_metadata, on: :create
  before_validation :normalize_fields
  before_validation :copy_division_name_from_record
  before_destroy :clear_feeder_game_links

  validates :start_time, presence: true
  validates :phase, inclusion: { in: PHASES }
  validates :status, inclusion: { in: STATUSES }
  validates :bracket_round, inclusion: { in: BRACKET_ROUNDS }, allow_nil: true
  validates :bracket_slot, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :game_number, length: { maximum: 32 }, uniqueness: { scope: :tournament_id, case_sensitive: false }, allow_nil: true
  validates :status_note, length: { maximum: 240 }, allow_nil: true
  validates :last_score_mutation_id, format: { with: MUTATION_ID_FORMAT }, allow_nil: true
  validates :home_score, :away_score, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 300 }, allow_nil: true
  validates_https_url :stream_url, :ticket_url, if_changed: true

  validate :division_record_exists
  validate :division_record_belongs_to_tournament
  validate :teams_are_distinct
  validate :teams_belong_to_tournament
  validate :next_game_is_valid
  validate :tournament_id_immutable, on: :update

  def phase=(value)
    @explicit_phase_assigned = true
    super
  end

  scope :ordered, -> { order(:start_time, :id) }
  scope :scored, -> { where.not(home_score: nil).where.not(away_score: nil) }
  scope :finals, -> { where(status: "final").scored }
  scope :pool_games, -> { where(phase: "pool") }
  scope :playoff_games, -> { where(phase: "playoff") }

  def resolved_division
    division_record&.name || division.presence || home_team&.resolved_division
  end

  def pool_phase?
    phase == "pool"
  end

  def playoff_phase?
    phase == "playoff"
  end

  def fatherson_phase?
    phase == "fatherson"
  end

  def exhibition_phase?
    phase == "exhibition"
  end

  def special_division?
    return !division_record.counts_for_standings? if division_record

    resolved_division.to_s.casecmp?("Special") ||
      home_team&.special_division? ||
      away_team&.special_division?
  end

  def standings_pool_eligible_schedule_game?
    return false if placeholder?
    return false unless pool_phase?
    return false if status == "cancelled"
    return false if special_division?
    return false if home_team.nil? || away_team.nil?
    return false if home_team.excluded_from_standings? || away_team.excluded_from_standings?
    return false if home_team.division_id != away_team.division_id
    return false if division_id.present? && division_id != home_team.division_id

    true
  end

  def standings_exclusion_reason
    return "not_final" unless status == "final" && home_score.present? && away_score.present?
    return "placeholder_game" if placeholder?
    return "non_pool_phase" unless pool_phase?
    return "non_standings_division" if special_division?
    return "excluded_home_team" if home_team&.excluded_from_standings?
    return "excluded_away_team" if away_team&.excluded_from_standings?
    return "cross_division" if home_team && away_team && home_team.division_id != away_team.division_id
    return "division_mismatch" if division_id.present? && home_team && division_id != home_team.division_id

    nil
  end

  def counts_toward_standings?
    standings_exclusion_reason.nil?
  end

  def summary_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      startTime: start_time&.iso8601,
      venue: venue,
      phase: phase,
      gameNumber: game_number,
      status: status,
      statusNote: status_note,
      homeScore: home_score,
      awayScore: away_score,
      lockVersion: lock_version,
      homeTeam: team_summary(home_team),
      awayTeam: team_summary(away_team)
    }
  end

  def api_json(include_teams: true, include_rosters: false, include_score_audit: false)
    payload = {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      homeTeamId: home_team_id.to_s,
      awayTeamId: away_team_id.to_s,
      startTime: start_time&.iso8601,
      venue: venue,
      phase: phase,
      gameNumber: game_number,
      status: status,
      statusNote: status_note,
      homeScore: home_score,
      awayScore: away_score,
      streamUrl: external_url(stream_url),
      ticketUrl: external_url(ticket_url),
      notes: notes,
      divisionId: division_id&.to_s,
      division: resolved_division,
      bracketCode: bracket_code,
      bracketRound: bracket_round,
      bracketSlot: bracket_slot,
      nextGameId: next_game_id&.to_s,
      nextGameSlot: next_game_slot,
      placeholder: placeholder,
      lockVersion: lock_version,
      scoreUpdatedAt: score_updated_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }

    payload[:scoreUpdatedByName] = score_updated_by&.full_name if include_score_audit

    if include_teams
      payload[:homeTeam] = team_summary(home_team, include_roster: include_rosters)
      payload[:awayTeam] = team_summary(away_team, include_roster: include_rosters)
    end

    payload
  end

  private

  def infer_phase_from_legacy_metadata
    return if @explicit_phase_assigned

    notes_str = notes.to_s
    code = bracket_code.to_s.strip
    if notes_str.include?("phase=fatherson") || code.match?(/\AFS/i)
      self.phase = "fatherson"
    elsif notes_str.include?("phase=playoff") || code.match?(/\A([WL]?(MP|GP|PP)|[MGP]?(QF|SF|F)|L)[0-9]*\z/i)
      self.phase = "playoff"
    elsif notes_str.include?("phase=exhibition")
      self.phase = "exhibition"
    end
  end

  def normalize_fields
    self.phase = phase.to_s.strip.downcase.presence || "pool"
    self.status = status.to_s.strip.downcase.presence || "scheduled"
    self.game_number = game_number.to_s.strip.presence
    self.bracket_code = bracket_code.to_s.strip.presence
    self.bracket_round = bracket_round.to_s.strip.downcase.presence
    self.next_game_slot = next_game_id.present? ? next_game_slot.to_s.strip.downcase.presence : nil
    self.status_note = status_note.to_s.strip.presence
    self.stream_url = stream_url.to_s.strip.presence
    self.ticket_url = ticket_url.to_s.strip.presence
  end

  def clear_feeder_game_links
    feeder_games.update_all(next_game_id: nil, next_game_slot: nil)
  end

  def external_url(value)
    uri = parse_safe_https_uri(value)
    uri&.to_s
  end

  def team_summary(team, include_roster: false)
    return nil unless team

    payload = {
      id: team.id.to_s,
      displayName: team.display_name,
      classYearLabel: team.class_year_label,
      classCohorts: team.class_cohorts_for_api,
      divisionId: team.division_id&.to_s,
      division: team.resolved_division
    }

    payload[:rosterEntries] = team.roster_entries_api_json(active_only: true) if include_roster
    payload
  end

  def copy_division_name_from_record
    self.division = division_record.name if division_record
  end

  def division_record_exists
    return if division_id.blank? || division_record

    errors.add(:division_id, "is not valid")
  end

  def division_record_belongs_to_tournament
    return unless division_record && tournament_id.present?

    if division_record.tournament_id != tournament_id
      errors.add(:division_id, "must belong to the same tournament")
    elsif (new_record? || will_save_change_to_division_id?) && !division_record.active?
      errors.add(:division_id, "is not active for this tournament")
    end
  end

  def tournament_id_immutable
    return unless will_save_change_to_tournament_id?

    errors.add(:tournament_id, "cannot be changed once created")
  end

  def teams_are_distinct
    return if home_team_id.blank? || away_team_id.blank? || home_team_id != away_team_id
    return if placeholder?

    errors.add(:away_team_id, "must be different from home team")
  end

  def teams_belong_to_tournament
    return if tournament_id.blank?

    if home_team && home_team.tournament_id != tournament_id
      errors.add(:home_team_id, "must belong to the same tournament")
    end

    if away_team && away_team.tournament_id != tournament_id
      errors.add(:away_team_id, "must belong to the same tournament")
    end
  end

  def next_game_is_valid
    if next_game_id.present? != next_game_slot.present?
      errors.add(:next_game_slot, "must be set together with next_game_id")
      return
    end

    return if next_game_id.blank?

    unless NEXT_GAME_SLOTS.include?(next_game_slot)
      errors.add(:next_game_slot, "must be 'home' or 'away'")
    end

    if id.present? && next_game_id == id
      errors.add(:next_game_id, "cannot point to the same game")
      return
    end

    target = next_game
    unless target
      errors.add(:next_game_id, "is not valid")
      return
    end

    if tournament_id.present? && target.tournament_id != tournament_id
      errors.add(:next_game_id, "must belong to the same tournament")
    end

    unless %w[playoff fatherson].include?(target.phase)
      errors.add(:next_game_id, "must target a playoff or father-son bracket game")
    end

    if division_id.present? && target.division_id.present? && target.division_id != division_id
      errors.add(:next_game_id, "must belong to the same division")
    end

    # Unique downstream slot check
    conflict = Game.where(next_game_id: next_game_id, next_game_slot: next_game_slot)
    conflict = conflict.where.not(id: id) if id.present?
    if conflict.exists?
      errors.add(:next_game_slot, "is already fed by another game")
    end

    # Cycle and max-depth check (rejects cycles or chains deeper than MAX_BRACKET_DEPTH)
    visited = id.present? ? Set.new([ id ]) : Set.new
    cursor = target
    hops = 0
    while cursor
      if visited.include?(cursor.id)
        errors.add(:next_game_id, "creates a bracket cycle")
        return
      end
      visited.add(cursor.id)
      hops += 1
      if hops > MAX_BRACKET_DEPTH
        errors.add(:next_game_id, "exceeds maximum bracket depth (#{MAX_BRACKET_DEPTH})")
        return
      end
      cursor = cursor.next_game_id.present? ? Game.find_by(id: cursor.next_game_id) : nil
    end
  end
end
