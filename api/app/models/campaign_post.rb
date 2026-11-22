class CampaignPost < ApplicationRecord
  include SafeUrlValidation

  belongs_to :host_campaign
  belongs_to :author, class_name: "User", optional: true

  before_validation :normalize_fields

  validates :title, presence: true, length: { maximum: 180 }
  validates :body, presence: true
  validates_https_url :image_url

  scope :published, -> { where.not(published_at: nil).where("published_at <= ?", Time.current) }
  scope :ordered, -> { order(pinned: :desc, published_at: :desc, id: :desc) }

  def published?
    published_at.present? && published_at <= Time.current
  end

  def public_json
    {
      id: id.to_s,
      title: title,
      body: body,
      imageUrl: image_url,
      publishedAt: published_at&.iso8601,
      pinned: pinned,
      authorName: author_display_name
    }
  end

  private

  def normalize_fields
    self.title = title.to_s.strip if title.present?
    self.body = body.to_s.strip if body.present?
    self.image_url = image_url.to_s.strip.presence
  end

  def author_display_name
    return nil unless author

    [ author.first_name, author.last_name ].compact_blank.join(" ").presence
  end
end
