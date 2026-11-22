class MediaAsset < ApplicationRecord
  include SafeUrlValidation

  MEDIA_TYPES = %w[photo video gallery].freeze
  YOUTUBE_ID_REGEX = /\A[a-zA-Z0-9_-]{11}\z/
  belongs_to :tournament
  belongs_to :game, optional: true

  before_validation :normalize_media_fields
  before_validation :set_youtube_thumbnail

  validates :source, :title, presence: true
  validates :media_type, inclusion: { in: MEDIA_TYPES }
  validates :image_url, presence: true, unless: :video?
  validates :video_url, presence: true, if: :video?
  validates :external_video_id, uniqueness: { scope: :tournament_id }, allow_nil: true
  validates :external_video_id, format: { with: YOUTUBE_ID_REGEX }, if: :youtube?
  validates_https_url :video_url, :article_url, strict: true
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
      mediaType: media_type,
      videoUrl: video_url,
      videoProvider: video_provider,
      externalVideoId: external_video_id,
      embedUrl: ("https://www.youtube-nocookie.com/embed/#{external_video_id}" if youtube_video?),
      durationSeconds: duration_seconds,
      divisionSlug: division_slug,
      caption: caption,
      tags: tags,
      tagList: tag_list,
      takenAt: taken_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def video?
    media_type == "video"
  end

  def youtube?
    video_provider == "youtube"
  end

  def youtube_video?
    video? && youtube? && YOUTUBE_ID_REGEX.match?(external_video_id)
  end

  def normalize_media_fields
    self.external_video_id = external_video_id.to_s.strip.presence
    self.video_provider = video_provider.to_s.strip.presence
    self.video_url = video_url.to_s.strip.presence
    self.image_url = image_url.to_s.strip.presence
  end

  def set_youtube_thumbnail
    self.image_url = "https://i.ytimg.com/vi/#{external_video_id}/hqdefault.jpg" if image_url.blank? && youtube_video?
  end

  def game_belongs_to_tournament
    return if game_id.blank? || tournament_id.blank? || game&.tournament_id == tournament_id

    errors.add(:game_id, "must belong to the same tournament")
  end
end
