class PlayerGameStat < ApplicationRecord
  METRIC_LIMITS = {
    points: 200, rebounds: 200, assists: 200, steals: 200, blocks: 200,
    three_pointers_made: 200, fouls: 10, minutes: 120
  }.freeze

  belongs_to :game
  belongs_to :team
  belongs_to :roster_entry

  attr_readonly :game_id, :team_id, :roster_entry_id, :player_name_snapshot, :jersey_number_snapshot

  before_validation :snapshot_roster_entry, on: :create

  validates :roster_entry_id, uniqueness: { scope: :game_id }
  validates :player_name_snapshot, presence: true
  validates :notes, length: { maximum: 500 }
  METRIC_LIMITS.each do |metric, limit|
    validates metric, numericality: { only_integer: true, in: 0..limit }, allow_nil: true
  end
  validate :eligible_roster_entry

  def public_json
    {
      rosterEntryId: roster_entry_id.to_s,
      teamId: team_id.to_s,
      playerName: player_name_snapshot,
      jerseyNumber: jersey_number_snapshot
    }.merge(METRIC_LIMITS.keys.to_h { |metric| [ metric.to_s.camelize(:lower), public_send(metric) ] })
  end

  def admin_json
    public_json.merge(notes: notes)
  end

  private

  def snapshot_roster_entry
    self.player_name_snapshot = roster_entry&.name
    self.jersey_number_snapshot = roster_entry&.jersey_number
  end

  def eligible_roster_entry
    if roster_entry && roster_entry.team_id != team_id
      errors.add(:roster_entry, "must belong to the selected team")
    end
    return unless game && team

    errors.add(:team, "must be playing in this game") unless [ game.home_team_id, game.away_team_id ].include?(team_id)
    errors.add(:team, "must belong to the game's tournament") unless team.tournament_id == game.tournament_id
  end
end
