class GameDayNote < ApplicationRecord
  belongs_to :tournament

  validates :date, presence: true, uniqueness: { scope: :tournament_id }

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(date: :desc, id: :desc) }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      date: date&.iso8601,
      hostClass: host_class,
      foodMenu: food_menu,
      announcement: announcement,
      sponsorShoutout: sponsor_shoutout,
      active: active,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
