class Team < ApplicationRecord
  belongs_to :tournament
  belongs_to :division_record, class_name: "Division", foreign_key: :division_id, optional: true, inverse_of: false

  has_many :home_games, class_name: "Game", foreign_key: :home_team_id, dependent: :restrict_with_error, inverse_of: :home_team
  has_many :away_games, class_name: "Game", foreign_key: :away_team_id, dependent: :restrict_with_error, inverse_of: :away_team
  has_many :standings, dependent: :destroy
  has_many :roster_entries, dependent: :destroy
  has_many :prediction_votes, dependent: :destroy
  has_many :team_class_memberships, dependent: :destroy
  has_many :class_cohorts, through: :team_class_memberships

  before_validation :copy_division_name_from_record
  after_commit :sync_class_memberships, if: :class_membership_source_changed?

  validates :class_year_label, :display_name, presence: true
  validates :display_name, uniqueness: { scope: :tournament_id }
  validate :division_record_exists
  validate :division_record_belongs_to_tournament

  def resolved_division
    division_record&.name || division
  end

  def special_division?
    return !division_record.counts_for_standings? if division_record

    resolved_division.to_s.casecmp?("Special")
  end

  def fatherson_team?
    [ display_name, class_year_label ].any? do |label|
      text = label.to_s.strip
      text.match?(/\A(?:class\s+)?(?:\d+s?\s+)?FS\d*\z/i) || text.match?(/father[\s-]*son/i)
    end
  end

  def placeholder_team?
    [ display_name, class_year_label ].any? do |label|
      text = label.to_s.strip
      text.match?(/\A(?:class\s+)?(?:tbd|placeholder)\b/i) ||
        text.match?(/\b(?:winner|loser)\b/i) ||
        text.match?(/\bseed\s*\d+\b/i) ||
        text.match?(/\b[WL](?:MP|GP|PP)\d*\b/i)
    end
  end

  def standings_exclusion_reason
    return "no_division" if division_id.blank?
    return "inactive_division" if division_record && !division_record.active?
    return "non_standings_division" if special_division?
    return "fatherson_team" if fatherson_team?
    return "placeholder_team" if placeholder_team?

    nil
  end

  def excluded_from_standings?
    standings_exclusion_reason.present?
  end

  def api_json(include_roster: false)
    payload = {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      tournamentYear: tournament&.year,
      classYearLabel: class_year_label,
      displayName: display_name,
      classCohorts: class_cohorts_for_api,
      divisionId: division_id&.to_s,
      division: resolved_division,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }

    payload[:rosterEntries] = roster_entries_api_json if include_roster
    payload
  end

  def roster_entries_api_json(active_only: false)
    roster_entries_for_api(active_only: active_only).map(&:api_json)
  end

  def class_cohorts_for_api
    return [] unless ClassCohort.table_exists? && TeamClassMembership.table_exists?

    memberships = if association(:team_class_memberships).loaded?
      loaded_memberships_with_cohorts
    else
      team_class_memberships.ordered.to_a
    end

    memberships.map(&:class_cohort).compact.map(&:api_json)
  end

  private

  def loaded_memberships_with_cohorts
    memberships = team_class_memberships.to_a
    preload_membership_cohorts(memberships)
    memberships.sort_by { |membership| [ membership.position, membership.class_cohort&.graduation_year || 0 ] }
  end

  def preload_membership_cohorts(memberships)
    return if memberships.empty? || memberships.all? { |membership| membership.association(:class_cohort).loaded? }

    ActiveRecord::Associations::Preloader.new(records: memberships, associations: :class_cohort).call
  end

  def roster_entries_for_api(active_only: false)
    return roster_entries_scope(active_only: active_only).ordered.to_a unless association(:roster_entries).loaded?

    entries = roster_entries.to_a
    entries = entries.select(&:active?) if active_only
    entries.sort_by { |entry| [ entry.sort_order || 0, entry.jersey_number.to_s, entry.name.to_s, entry.id || 0 ] }
  end

  def roster_entries_scope(active_only: false)
    active_only ? roster_entries.active : roster_entries
  end

  def copy_division_name_from_record
    self.division = division_record.name if division_record
  end

  def division_record_exists
    return if division_id.blank? || division_record

    errors.add(:division_id, "is not valid")
  end

  def class_membership_source_changed?
    previous_changes.key?("display_name") || previous_changes.key?("class_year_label")
  end

  def sync_class_memberships
    ClassArchive::SyncTeamMemberships.call(self)
  end

  def division_record_belongs_to_tournament
    return unless division_record && tournament_id.present?

    if division_record.tournament_id != tournament_id
      errors.add(:division_id, "must belong to the same tournament")
    elsif (new_record? || will_save_change_to_division_id?) && !division_record.active?
      errors.add(:division_id, "is not active for this tournament")
    end
  end
end
