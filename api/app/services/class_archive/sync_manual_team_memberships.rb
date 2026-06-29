module ClassArchive
  class SyncManualTeamMemberships
    MANUAL_SOURCE = "manual".freeze

    class ConflictError < StandardError
      attr_reader :conflicts

      def initialize(conflicts)
        @conflicts = conflicts
        super(build_message(conflicts))
      end

      private

      def build_message(conflicts)
        return "Class is already assigned to another team in this tournament." if conflicts.empty?

        grouped = conflicts.group_by(&:class_cohort)
        details = grouped.map do |cohort, memberships|
          team_names = memberships.map { |membership| membership.team.display_name }.uniq.to_sentence
          "#{cohort.display_name} is already assigned to #{team_names}"
        end

        "#{details.to_sentence}. Remove the class from the existing team before assigning it here."
      end
    end

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
      conflicts = conflicting_memberships(cohort_ids)
      raise ConflictError.new(conflicts) if conflicts.any?

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

    def conflicting_memberships(cohort_ids)
      return [] if cohort_ids.empty? || team.tournament_id.blank?

      TeamClassMembership.includes(:team, :class_cohort)
        .joins(:team)
        .where(class_cohort_id: cohort_ids, teams: { tournament_id: team.tournament_id })
        .where.not(team_id: team.id)
        .to_a
    end
  end
end
