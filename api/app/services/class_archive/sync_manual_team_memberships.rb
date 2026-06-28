module ClassArchive
  class SyncManualTeamMemberships
    MANUAL_SOURCE = "manual".freeze

    def self.call(team, class_keys:)
      new(team, class_keys: class_keys).call
    end

    def initialize(team, class_keys:)
      @team = team
      @class_keys = Array(class_keys)
    end

    def call
      return { teamId: team.id&.to_s, memberships: 0, skipped: true } unless ready?

      cohorts = resolved_cohorts
      cohort_ids = cohorts.map(&:id)

      TeamClassMembership.transaction do
        team.team_class_memberships.where.not(class_cohort_id: cohort_ids).delete_all

        cohorts.each_with_index do |cohort, index|
          membership = team.team_class_memberships.find_or_initialize_by(class_cohort: cohort)
          membership.source = MANUAL_SOURCE
          membership.position = index + 1
          membership.save!
        end
      end

      { teamId: team.id.to_s, memberships: cohorts.length, skipped: false }
    end

    private

    attr_reader :team, :class_keys

    def ready?
      team&.persisted? && ClassCohort.table_exists? && TeamClassMembership.table_exists?
    end

    def resolved_cohorts
      class_keys.flat_map { |value| ClassArchive::Resolver.resolve_cohorts(value) }.uniq(&:id)
    end
  end
end
