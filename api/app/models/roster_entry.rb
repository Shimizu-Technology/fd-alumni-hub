class RosterEntry < ApplicationRecord
  belongs_to :team

  before_validation :normalize_fields

  validates :name, presence: true, uniqueness: { scope: :team_id, case_sensitive: false }

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

  private

  def normalize_fields
    self.name = name.to_s.strip
    self.jersey_number = jersey_number.to_s.strip.presence
    self.position = position.to_s.strip.presence
    self.nickname = nickname.to_s.strip.presence
  end
end
