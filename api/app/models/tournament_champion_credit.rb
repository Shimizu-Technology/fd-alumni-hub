class TournamentChampionCredit < ApplicationRecord
  CREDIT_TYPES = %w[champion].freeze

  belongs_to :tournament_champion
  belongs_to :class_cohort

  validates :credit_type, :source, presence: true
  validates :credit_type, inclusion: { in: CREDIT_TYPES }
  validates :class_cohort_id, uniqueness: { scope: :tournament_champion_id }

  scope :ordered, -> { includes(:class_cohort).order(:position, "class_cohorts.graduation_year") }

  def api_json
    {
      id: id.to_s,
      tournamentChampionId: tournament_champion_id.to_s,
      classCohortId: class_cohort_id.to_s,
      creditType: credit_type,
      source: source,
      position: position,
      classCohort: class_cohort.api_json,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
