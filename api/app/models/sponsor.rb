class Sponsor < ApplicationRecord
  belongs_to :tournament

  validates :name, presence: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :name) }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      name: name,
      logoUrl: logo_url,
      targetUrl: target_url,
      tier: tier,
      active: active,
      position: position,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
