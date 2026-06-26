class Game < ApplicationRecord
  STATUSES = %w[scheduled live final].freeze

  belongs_to :tournament
  belongs_to :division_record, class_name: "Division", foreign_key: :division_id, optional: true, inverse_of: false
  belongs_to :home_team, class_name: "Team", inverse_of: :home_games
  belongs_to :away_team, class_name: "Team", inverse_of: :away_games

  has_many :article_links, dependent: :nullify
  has_many :media_assets, dependent: :nullify
  has_many :prediction_polls, dependent: :destroy

  validates :start_time, presence: true
  validates :status, inclusion: { in: STATUSES }
  before_validation :copy_division_name_from_record

  validates :home_score, :away_score, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :division_record_exists
  validate :division_record_is_available_for_tournament
  validate :teams_are_distinct
  validate :teams_belong_to_tournament

  scope :ordered, -> { order(:start_time, :id) }
  scope :scored, -> { where.not(home_score: nil).where.not(away_score: nil) }
  scope :finals, -> { where(status: "final").scored }

  def resolved_division
    division_record&.name || division.presence || home_team&.resolved_division
  end

  def pool_phase?
    notes.to_s.include?("phase=pool")
  end

  def playoff_phase?
    notes.to_s.include?("phase=playoff")
  end

  def fatherson_phase?
    bracket_code == "FS" || home_team&.display_name.to_s.match?(/\bFS\b/i) || away_team&.display_name.to_s.match?(/\bFS\b/i)
  end

  def summary_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      startTime: start_time&.iso8601,
      venue: venue,
      status: status,
      homeScore: home_score,
      awayScore: away_score,
      homeTeam: team_summary(home_team),
      awayTeam: team_summary(away_team)
    }
  end

  def api_json(include_teams: true, include_rosters: false)
    payload = {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      homeTeamId: home_team_id.to_s,
      awayTeamId: away_team_id.to_s,
      startTime: start_time&.iso8601,
      venue: venue,
      status: status,
      homeScore: home_score,
      awayScore: away_score,
      streamUrl: external_url(stream_url),
      ticketUrl: external_url(ticket_url),
      notes: notes,
      divisionId: division_id&.to_s,
      division: resolved_division,
      bracketCode: bracket_code,
      placeholder: placeholder,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }

    if include_teams
      payload[:homeTeam] = team_summary(home_team, include_roster: include_rosters)
      payload[:awayTeam] = team_summary(away_team, include_roster: include_rosters)
    end

    payload
  end

  private

  def external_url(value)
    url = value.to_s.strip
    return nil if url.blank?
    return "https:#{url}" if url.start_with?("//")
    return url if url.match?(/\A[a-z][a-z0-9+.-]*:/i)

    "https://#{url}"
  end

  def team_summary(team, include_roster: false)
    return nil unless team

    payload = {
      id: team.id.to_s,
      displayName: team.display_name,
      classYearLabel: team.class_year_label,
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

  def division_record_is_available_for_tournament
    return unless division_record && tournament
    return if division_record.available_for?(tournament)

    errors.add(:division_id, "is not available for this tournament year")
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
end
