class ClassCohort < ApplicationRecord
  has_many :team_class_memberships, dependent: :destroy
  has_many :teams, through: :team_class_memberships
  has_many :tournament_champion_credits, dependent: :destroy
  has_many :tournament_champions, through: :tournament_champion_credits

  validates :key, :graduation_year, :display_name, :short_label, presence: true
  validates :key, :graduation_year, uniqueness: true
  validates :graduation_year, numericality: { only_integer: true }

  scope :ordered, -> { order(:graduation_year) }

  def api_json
    {
      id: id.to_s,
      key: key,
      routeKey: key.tr("/", "-"),
      graduationYear: graduation_year,
      displayName: display_name,
      shortLabel: short_label,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
