class Tournament < ApplicationRecord
  STATUSES = %w[upcoming live completed cancelled].freeze

  has_one :host_campaign, dependent: :restrict_with_error
  has_many :standings, dependent: :destroy
  has_many :games, dependent: :destroy
  has_many :teams, dependent: :destroy
  has_many :divisions, dependent: :destroy
  has_many :article_links, dependent: :destroy
  has_many :media_assets, dependent: :destroy
  has_many :sponsors, dependent: :destroy
  has_many :tournament_alerts, dependent: :destroy
  has_many :content_ingest_items, dependent: :destroy
  has_many :game_day_notes, dependent: :destroy
  has_many :prediction_polls, dependent: :destroy

  validates :name, presence: true
  validates :year, presence: true, numericality: { only_integer: true }
  validates :start_date, :end_date, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :name, uniqueness: { scope: :year }

  scope :live_tournaments, -> { where(status: "live").order(year: :desc, start_date: :desc, id: :desc) }
  scope :upcoming_or_live, -> { where(status: %w[live upcoming]).order(Arel.sql("CASE status WHEN 'live' THEN 0 ELSE 1 END, start_date ASC, year ASC, id ASC")) }
  scope :completed, -> { where(status: "completed") }
  scope :with_games, -> { joins(:games).distinct }

  scope :with_public_schedule, -> { completed.or(where.not(schedule_published_at: nil)) }

  def publicly_visible_schedule?
    schedule_published_at.present? || status == "completed"
  end

  def self.home_context
    live = live_tournaments.first
    upcoming_with_games = where(status: "upcoming").with_public_schedule.with_games.order(start_date: :asc, year: :asc, id: :asc).first
    earliest_upcoming = where(status: "upcoming").order(start_date: :asc, year: :asc, id: :asc).first

    {
      upcoming_or_live: live || upcoming_with_games || earliest_upcoming,
      latest_completed_with_games: completed.with_games.order(year: :desc, id: :desc).first
    }
  end

  def self.active_for_public(context = nil)
    context ||= home_context
    upcoming = context[:upcoming_or_live]

    if upcoming&.status == "live" || (upcoming&.publicly_visible_schedule? && upcoming.games.exists?)
      upcoming
    else
      context[:latest_completed_with_games] || upcoming
    end
  end

  def ensure_default_divisions!
    Division::DEFAULT_SPECS.map do |spec|
      slug = spec[:name].parameterize
      existing = divisions.where("lower(name) = ? OR slug = ?", spec[:name].downcase, slug).first
      next existing if existing

      divisions.create!(
        name: spec[:name],
        slug: slug,
        position: spec[:position],
        counts_for_standings: spec[:counts_for_standings],
        active: true
      )
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
