class TournamentChampion < ApplicationRecord
  STATUSES = %w[completed cancelled research_pending upcoming unknown].freeze
  BRACKETS = %w[overall maroon gold unknown].freeze

  belongs_to :tournament, optional: true
  has_many :tournament_champion_credits, dependent: :destroy
  has_many :class_cohorts, through: :tournament_champion_credits

  before_validation :normalize_keys
  after_commit :sync_champion_credits, if: :champion_credit_source_changed?

  validates :year, :slug, :status, presence: true
  validates :year, numericality: { only_integer: true }
  validates :slug, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :bracket, inclusion: { in: BRACKETS }
  validates :champion_label, presence: true, unless: :cancelled?

  scope :ordered, -> { order(year: :desc, position: :asc, id: :asc) }
  scope :completed, -> { where(status: "completed") }
  scope :primary_titles, -> { where(primary: true) }
  scope :with_champion_key, -> { where.not(champion_key: [ nil, "" ]) }

  def self.for_team(team)
    class_ids = team.class_cohort_ids
    if class_ids.any?
      return completed.joins(:tournament_champion_credits)
        .where(tournament_champion_credits: { class_cohort_id: class_ids })
        .distinct
        .ordered
    end

    keys = [ canonical_key(team.display_name), canonical_key(team.class_year_label) ].reject(&:blank?).uniq
    return none if keys.empty?

    completed.with_champion_key.where(champion_key: keys).ordered
  end

  def self.title_counts
    credit_counts(primary_only: true)
  end

  def self.entry_title_counts
    completed.primary_titles.with_champion_key.ordered.group_by(&:champion_key).map do |champion_key, records|
      sorted_records = records.sort_by { |record| [ -record.year, record.position ] }
      {
        championKey: champion_key,
        championLabel: sorted_records.first.champion_label,
        titles: records.length,
        years: records.map(&:year).uniq.sort.reverse,
        records: sorted_records.map(&:api_json)
      }
    end.sort_by { |entry| [ -entry[:titles], entry[:championLabel] ] }
  end

  def self.credit_counts(primary_only: true)
    scope = TournamentChampionCredit.includes(:class_cohort, :tournament_champion)
      .joins(:tournament_champion)
      .merge(completed.with_champion_key)
    scope = scope.merge(primary_titles) if primary_only

    scope.to_a.group_by(&:class_cohort).map do |cohort, credits|
      records = credits.map(&:tournament_champion).uniq
      sorted_records = records.sort_by { |record| [ -record.year, record.position ] }
      {
        championKey: cohort.key,
        championLabel: cohort.display_name,
        titles: records.length,
        years: records.map(&:year).uniq.sort.reverse,
        records: sorted_records.map(&:api_json)
      }
    end.sort_by { |entry| [ -entry[:titles], entry[:championLabel] ] }
  end

  def self.canonical_key_from_route(value)
    canonical_key(value.to_s.tr("-", "/"))
  end

  def self.route_key(value)
    canonical_key(value).tr("/", "-")
  end

  def self.canonical_key(value)
    text = value.to_s.downcase.gsub(/class\s+of/, "").gsub(/class/, "").tr("’'", "").strip
    segments = text.scan(/ad\d+|\d{2,4}/)
    if segments.any?
      return segments.map do |segment|
        segment.start_with?("ad") ? segment : segment.length == 4 ? segment[-2, 2] : segment.rjust(2, "0")
      end.join("/")
    end

    text.gsub(/[^a-z0-9]+/, "")
  end

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id&.to_s,
      year: year,
      editionLabel: edition_label.presence,
      label: label,
      championLabel: champion_label.presence,
      championKey: champion_key.presence,
      championComponents: champion_components,
      creditedClasses: credited_classes_json,
      runnerUpLabel: runner_up_label.presence,
      runnerUpKey: runner_up_key.presence,
      score: score.presence,
      bracket: bracket,
      primary: primary,
      status: status,
      source: source,
      notes: notes.presence,
      position: position,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  def label
    edition_label.present? ? "#{year} #{edition_label}" : year.to_s
  end

  def champion_components
    champion_key.to_s.split("/").reject(&:blank?)
  end

  def credited_classes_json
    return [] unless ClassCohort.table_exists? && TournamentChampionCredit.table_exists?

    credits = if association(:tournament_champion_credits).loaded?
      tournament_champion_credits.to_a.sort_by { |credit| [ credit.position, credit.class_cohort&.graduation_year || 0 ] }
    else
      tournament_champion_credits.ordered.to_a
    end

    credits.map(&:class_cohort).compact.map(&:api_json)
  end

  private

  def normalize_keys
    self.edition_label = edition_label.to_s.strip
    self.champion_label = champion_label.to_s.strip
    self.runner_up_label = runner_up_label.to_s.strip.presence
    self.bracket = bracket.to_s.strip.presence || "overall"
    self.champion_key = self.class.canonical_key(champion_key.presence || champion_label)
    self.runner_up_key = self.class.canonical_key(runner_up_key.presence || runner_up_label)
    self.slug = slug.to_s.strip.presence || [ year, edition_label.presence ].compact.join("-").parameterize
  end

  def champion_credit_source_changed?
    previous_changes.key?("champion_key") || previous_changes.key?("champion_label") || previous_changes.key?("status")
  end

  def sync_champion_credits
    ClassArchive::SyncChampionCredits.call(self)
  end

  def cancelled?
    status == "cancelled"
  end
end
