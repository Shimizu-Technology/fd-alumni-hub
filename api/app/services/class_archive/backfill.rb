module ClassArchive
  class Backfill
    def self.call
      new.call
    end

    def call
      return skipped_result unless ready?

      team_results = Team.find_each.map { |team| ClassArchive::SyncTeamMemberships.call(team) }
      champion_results = TournamentChampion.find_each.map { |champion| ClassArchive::SyncChampionCredits.call(champion) }

      {
        classCohorts: ClassCohort.count,
        teamMemberships: TeamClassMembership.count,
        championCredits: TournamentChampionCredit.count,
        teamsSynced: team_results.count { |result| !result[:skipped] },
        championsSynced: champion_results.count { |result| !result[:skipped] },
        teamsWithoutMemberships: Team.left_outer_joins(:team_class_memberships).where(team_class_memberships: { id: nil }).count
      }
    end

    private

    def ready?
      ClassCohort.table_exists? && TeamClassMembership.table_exists? && TournamentChampionCredit.table_exists?
    end

    def skipped_result
      {
        classCohorts: 0,
        teamMemberships: 0,
        championCredits: 0,
        teamsSynced: 0,
        championsSynced: 0,
        teamsWithoutMemberships: 0,
        skipped: true
      }
    end
  end
end
