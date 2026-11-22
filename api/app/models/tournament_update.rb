class TournamentUpdate < ApplicationRecord
  belongs_to :tournament
  belongs_to :author, class_name: "User", optional: true

  validates :title, presence: true, length: { maximum: 140 }
  validates :body, presence: true, length: { maximum: 4000 }
  validates :pinned, inclusion: { in: [ true, false ] }
  validates :status, inclusion: { in: %w[draft published] }
  before_save { self.published_at ||= Time.current if status == "published" }

  scope :ordered, -> { order(pinned: :desc).order(Arel.sql("published_at DESC NULLS LAST"), id: :desc) }
  scope :for_night, ->(date) { where(target_date: [ nil, date ]) }
  scope :unexpired, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def api_json
    {
      id: id.to_s, tournamentId: tournament_id.to_s, title: title, body: body,
      targetDate: target_date&.iso8601, status: status, publishedAt: published_at&.iso8601,
      expiresAt: expires_at&.iso8601, pinned: pinned
    }
  end
end
