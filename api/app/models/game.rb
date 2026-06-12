class Game < ApplicationRecord
  STATUSES = %w[scheduled live final].freeze

  belongs_to :tournament
  belongs_to :home_team, class_name: "Team", inverse_of: :home_games
  belongs_to :away_team, class_name: "Team", inverse_of: :away_games

  validates :start_time, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :home_score, :away_score, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validate :teams_are_distinct
  validate :teams_belong_to_tournament

  scope :ordered, -> { order(:start_time, :id) }
  scope :scored, -> { where.not(home_score: nil).where.not(away_score: nil) }
  scope :finals, -> { where(status: "final").scored }

  def resolved_division
    division.presence || home_team&.division
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

  def api_json(include_teams: true)
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
      streamUrl: stream_url,
      ticketUrl: ticket_url,
      notes: notes,
      division: division,
      bracketCode: bracket_code,
      placeholder: placeholder,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }

    if include_teams
      payload[:homeTeam] = team_summary(home_team)
      payload[:awayTeam] = team_summary(away_team)
    end

    payload
  end

  private

  def team_summary(team)
    return nil unless team

    {
      id: team.id.to_s,
      displayName: team.display_name,
      classYearLabel: team.class_year_label,
      division: team.division
    }
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
