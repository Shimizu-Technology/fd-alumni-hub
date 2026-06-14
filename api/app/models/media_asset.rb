class MediaAsset < ApplicationRecord
  belongs_to :tournament
  belongs_to :game, optional: true

  validates :source, :title, :image_url, presence: true
  validate :game_belongs_to_tournament

  scope :latest, -> { order(taken_at: :desc, created_at: :desc, id: :desc) }

  def tag_list
    tags.to_s.split(",").map(&:strip).reject(&:blank?)
  end

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      gameId: game_id&.to_s,
      game: game&.summary_json,
      source: source,
      title: title,
      imageUrl: image_url,
      articleUrl: article_url,
      caption: caption,
      tags: tags,
      tagList: tag_list,
      takenAt: taken_at&.iso8601,
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
