module ClassArchive
  class SyncTeamMemberships
    AUTO_SOURCE = "auto".freeze

    def self.call(team)
      new(team).call
    end

    def initialize(team)
      @team = team
    end

    def call
      return { teamId: team.id&.to_s, memberships: 0, skipped: true } unless ready?

      return manual_result if manual_memberships?

      cohorts = resolved_cohorts
      cohort_ids = cohorts.map(&:id)
      auto_scope = team.team_class_memberships.where(source: AUTO_SOURCE)
      cohort_ids.empty? ? auto_scope.delete_all : auto_scope.where.not(class_cohort_id: cohort_ids).delete_all

      cohorts.each_with_index do |cohort, index|
        membership = team.team_class_memberships.find_or_initialize_by(class_cohort: cohort)
        membership.source = AUTO_SOURCE if membership.new_record? || membership.source.blank?
        membership.position = index + 1 if membership.source == AUTO_SOURCE
        membership.save!
      end

      { teamId: team.id.to_s, memberships: cohorts.length, skipped: false }
    end

    private

    attr_reader :team

    def ready?
      team&.persisted? && ClassCohort.table_exists? && TeamClassMembership.table_exists?
    end

    def manual_memberships?
      team.team_class_memberships.where.not(source: AUTO_SOURCE).exists?
    end

    def manual_result
      { teamId: team.id.to_s, memberships: team.team_class_memberships.count, skipped: false, manual: true }
    end

    def resolved_cohorts
      values = [ team.display_name, team.class_year_label ].compact_blank
      values.flat_map { |value| ClassArchive::Resolver.resolve_cohorts(value) }.uniq(&:id)
    end
  end
end
