class Division < ApplicationRecord
  DEFAULT_SPECS = [
    { name: "Maroon", position: 1, counts_for_standings: true },
    { name: "Gold", position: 2, counts_for_standings: true },
    { name: "Platinum", position: 3, counts_for_standings: true },
    { name: "Special", position: 4, counts_for_standings: false }
  ].freeze

  DEFAULT_NAMES = DEFAULT_SPECS.map { |spec| spec[:name] }.freeze

  belongs_to :tournament
  has_many :teams, dependent: :nullify
  has_many :games, dependent: :nullify

  before_validation :normalize_slug
  after_update :sync_assigned_names, if: :saved_change_to_name?
  after_commit :recompute_standings_if_eligibility_changed, on: :update

  validates :name, presence: true, uniqueness: { scope: :tournament_id, case_sensitive: false }
  validates :slug, presence: true, uniqueness: { scope: :tournament_id }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :starts_year, numericality: { only_integer: true, greater_than_or_equal_to: 1900 }, allow_nil: true
  validate :tournament_id_immutable, on: :update

  scope :active, -> { where(active: true) }
  scope :standings_eligible, -> { active.where(counts_for_standings: true) }
  scope :ordered, -> { order(:position, :name, :id) }
  scope :for_tournament, ->(tournament) {
    tid = tournament.respond_to?(:id) ? tournament.id : tournament
    where(tournament_id: tid)
  }
  scope :available_for, ->(tournament) { for_tournament(tournament).active }

  def available_for?(target_tournament)
    active? && target_tournament.present? && tournament_id == target_tournament.id
  end

  def api_json(tournament: nil)
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      name: name,
      slug: slug,
      startsYear: starts_year,
      position: position,
      active: active,
      countsForStandings: counts_for_standings,
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

  def recompute_standings_if_eligibility_changed
    return unless tournament && (previous_changes.key?("counts_for_standings") || previous_changes.key?("active"))

    Standings::Recompute.call(tournament)
  end

  def tournament_id_immutable
    return unless will_save_change_to_tournament_id?

    errors.add(:tournament_id, "cannot be changed once created")
  end
end
