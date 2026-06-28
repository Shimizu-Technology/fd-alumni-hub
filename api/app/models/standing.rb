class Standing < ApplicationRecord
  belongs_to :tournament
  belongs_to :team

  validates :team_id, uniqueness: { scope: :tournament_id }
  validates :wins, :losses, :points_for, :points_against,
    numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :team_belongs_to_tournament

  scope :ranked, -> { includes(team: [ :division_record, :team_class_memberships, :class_cohorts ]).order(wins: :desc, losses: :asc, points_for: :desc, points_against: :asc, id: :asc) }

  def point_differential
    points_for - points_against
  end

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      teamId: team_id.to_s,
      wins: wins,
      losses: losses,
      pointsFor: points_for,
      pointsAgainst: points_against,
      pointDifferential: point_differential,
      updatedAt: updated_at&.iso8601,
      team: {
        id: team.id.to_s,
        displayName: team.display_name,
        classYearLabel: team.class_year_label,
        classCohorts: team.class_cohorts_for_api,
        divisionId: team.division_id&.to_s,
        division: team.resolved_division
      }
    }
  end

  private

  def team_belongs_to_tournament
    return if team.nil? || tournament_id.blank? || team.tournament_id == tournament_id

    errors.add(:team_id, "must belong to the same tournament")
  end
end
