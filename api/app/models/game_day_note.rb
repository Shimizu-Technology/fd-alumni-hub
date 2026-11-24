class GameDayNote < ApplicationRecord
  belongs_to :tournament

  validates :date, presence: true, uniqueness: { scope: :tournament_id }

  validates :status, inclusion: { in: %w[draft published] }
  validate :validate_structured_copy
  before_save { self.published_at ||= Time.current if status == "published" }

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
      menuItems: menu_items,
      specialEvents: special_events,
      hostSpotlight: host_spotlight,
      photos: photos,
      status: status,
      publishedAt: published_at&.iso8601,
      lockVersion: lock_version,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def validate_structured_copy
    errors.add(:menu_items, "must contain valid menu items") unless TonightCopy.valid_rows?(menu_items, TonightCopy::MENU, "name")
    errors.add(:special_events, "must contain valid events") unless TonightCopy.valid_rows?(special_events, TonightCopy::EVENT, "title")
    errors.add(:photos, "must contain up to 16 valid photos") unless TonightCopy.valid_rows?(photos, TonightCopy::PHOTO, "url", max: 16)
    errors.add(:host_spotlight, "must contain valid public spotlight copy") unless TonightCopy.valid_object?(host_spotlight, TonightCopy::SPOTLIGHT)
  end
end
