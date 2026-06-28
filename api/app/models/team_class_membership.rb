class TeamClassMembership < ApplicationRecord
  belongs_to :team
  belongs_to :class_cohort

  validates :source, presence: true
  validates :class_cohort_id, uniqueness: { scope: :team_id }

  scope :ordered, -> { includes(:class_cohort).order(:position, "class_cohorts.graduation_year") }

  def api_json
    {
      id: id.to_s,
      teamId: team_id.to_s,
      classCohortId: class_cohort_id.to_s,
      source: source,
      notes: notes.presence,
      position: position,
      classCohort: class_cohort.api_json,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
