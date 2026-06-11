class ArticleLink < ApplicationRecord
  belongs_to :tournament

  validates :title, :source, :url, presence: true
  validates :url, uniqueness: { scope: :tournament_id }

  scope :latest, -> { order(published_at: :desc, created_at: :desc, id: :desc) }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      title: title,
      source: source,
      url: url,
      publishedAt: published_at&.iso8601,
      imageUrl: image_url,
      excerpt: excerpt,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
