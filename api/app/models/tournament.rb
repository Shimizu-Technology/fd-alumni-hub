class Tournament < ApplicationRecord
  STATUSES = %w[upcoming live completed cancelled].freeze

  has_many :teams, dependent: :destroy
  has_many :games, dependent: :destroy
  has_many :standings, dependent: :destroy
  has_many :article_links, dependent: :destroy
  has_many :media_assets, dependent: :destroy
  has_many :sponsors, dependent: :destroy
  has_many :content_ingest_items, dependent: :destroy

  validates :name, presence: true
  validates :year, presence: true, numericality: { only_integer: true }
  validates :start_date, :end_date, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :name, uniqueness: { scope: :year }

  scope :upcoming_or_live, -> { where(status: %w[live upcoming]).order(year: :desc) }
  scope :completed, -> { where(status: "completed") }
  scope :with_games, -> { joins(:games).distinct }

  def self.home_context
    {
      upcoming_or_live: upcoming_or_live.first,
      latest_completed_with_games: completed.with_games.order(year: :desc).first
    }
  end

  def self.active_for_public
    context = home_context
    upcoming = context[:upcoming_or_live]

    if upcoming&.games&.exists?
      upcoming
    else
      context[:latest_completed_with_games] || upcoming
    end
  end

  def api_json
    {
      id: id.to_s,
      name: name,
      year: year,
      startDate: start_date&.iso8601,
      endDate: end_date&.iso8601,
      status: status,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
