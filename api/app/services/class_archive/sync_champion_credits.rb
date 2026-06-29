module ClassArchive
  class SyncChampionCredits
    AUTO_SOURCE = "auto".freeze

    def self.call(champion)
      new(champion).call
    end

    def initialize(champion)
      @champion = champion
    end

    def call
      return { championId: champion.id&.to_s, credits: 0, skipped: true } unless ready?

      cohorts = champion.status == "completed" ? resolved_cohorts : []
      cohort_ids = cohorts.map(&:id)
      auto_scope = champion.tournament_champion_credits.where(source: AUTO_SOURCE)
      cohort_ids.empty? ? auto_scope.delete_all : auto_scope.where.not(class_cohort_id: cohort_ids).delete_all

      cohorts.each_with_index do |cohort, index|
        credit = champion.tournament_champion_credits.find_or_initialize_by(class_cohort: cohort)
        credit.source = AUTO_SOURCE if credit.new_record? || credit.source.blank?
        credit.credit_type = "champion"
        credit.position = index + 1 if credit.source == AUTO_SOURCE
        credit.save!
      end

      { championId: champion.id.to_s, credits: cohorts.length, skipped: false }
    end

    private

    attr_reader :champion

    def ready?
      champion&.persisted? && ClassCohort.table_exists? && TournamentChampionCredit.table_exists?
    end

    def resolved_cohorts
      values = [ champion.champion_key, champion.champion_label ].compact_blank
      values.flat_map { |value| ClassArchive::Resolver.resolve_cohorts(value) }.uniq(&:id)
    end
  end
end
