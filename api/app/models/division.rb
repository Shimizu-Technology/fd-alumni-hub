class Division < ApplicationRecord
  DEFAULT_NAMES = %w[Maroon Gold Diamond].freeze

  has_many :teams, dependent: :nullify
  has_many :games, dependent: :nullify

  before_validation :normalize_slug
  after_update :sync_assigned_names, if: :saved_change_to_name?

  validates :name, presence: true, uniqueness: { case_sensitive: false }
  validates :slug, presence: true, uniqueness: true
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :starts_year, numericality: { only_integer: true, greater_than_or_equal_to: 1900 }, allow_nil: true

  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(:position, :name) }
  scope :available_for, ->(tournament) {
    year = tournament.respond_to?(:year) ? tournament.year : tournament.to_i
    active.where("starts_year IS NULL OR starts_year <= ?", year)
  }

  def available_for?(tournament)
    active? && (starts_year.blank? || starts_year <= tournament.year)
  end

  def api_json(tournament: nil)
    {
      id: id.to_s,
      name: name,
      slug: slug,
      startsYear: starts_year,
      position: position,
      active: active,
      available: tournament ? available_for?(tournament) : active?,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_slug
    self.name = name.to_s.strip
    self.slug = name.parameterize if slug.blank? || will_save_change_to_name?
  end

  def sync_assigned_names
    timestamp = Time.current
    teams.update_all(division: name, updated_at: timestamp)
    games.update_all(division: name, updated_at: timestamp)
  end
end
