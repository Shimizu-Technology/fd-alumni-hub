class ArticleLink < ApplicationRecord
  belongs_to :tournament
  belongs_to :game, optional: true

  validates :title, :source, :url, presence: true
  validates :url, uniqueness: { scope: :tournament_id }
  validate :game_belongs_to_tournament

  scope :latest, -> { order(published_at: :desc, created_at: :desc, id: :desc) }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      gameId: game_id&.to_s,
      game: game&.summary_json,
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

  private

  def game_belongs_to_tournament
    return if game_id.blank? || tournament_id.blank? || game&.tournament_id == tournament_id

    errors.add(:game_id, "must belong to the same tournament")
  end
end
