class ScoreCorrectionRequest < ApplicationRecord
  STATUSES = %w[pending approved rejected].freeze
  PROPOSED_FIELDS = %i[home_score away_score status result_outcome official_winner_team_id status_note].freeze

  belongs_to :tournament
  belongs_to :game
  belongs_to :requested_by, class_name: "User"
  belongs_to :resolved_by, class_name: "User", optional: true

  validates :status, inclusion: { in: STATUSES }
  validates :reason, presence: true, length: { maximum: 500 }
  validates :resolution_note, length: { maximum: 500 }, allow_nil: true

  def proposed_result
    PROPOSED_FIELDS.index_with { |field| public_send("proposed_#{field}") }
  end

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      gameId: game_id.to_s,
      game: game.summary_json,
      requestedBy: requested_by.full_name,
      status: status,
      proposedHomeScore: proposed_home_score,
      proposedAwayScore: proposed_away_score,
      proposedStatus: proposed_status,
      proposedResultOutcome: proposed_result_outcome,
      proposedOfficialWinnerTeamId: proposed_official_winner_team_id&.to_s,
      proposedStatusNote: proposed_status_note,
      reason: reason,
      resolutionNote: resolution_note,
      resolvedAt: resolved_at&.iso8601,
      createdAt: created_at.iso8601
    }
  end
end
