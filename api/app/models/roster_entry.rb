class RosterEntry < ApplicationRecord
  belongs_to :team

  validates :name, presence: true

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:sort_order, :jersey_number, :name, :id) }

  def api_json
    {
      id: id.to_s,
      teamId: team_id.to_s,
      name: name,
      jerseyNumber: jersey_number,
      position: position,
      nickname: nickname,
      sortOrder: sort_order,
      active: active,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
