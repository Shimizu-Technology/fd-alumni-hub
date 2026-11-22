module HostCampaigns
  class FinalReport
    def self.call(campaign)
      new(campaign).call
    end

    def initialize(campaign)
      @campaign = campaign
      @tournament = campaign.tournament
    end

    def call
      finance = HostCampaigns::FinanceSummary.call(@campaign)
      closeout = HostCampaigns::CloseoutCheck.call(@campaign)

      champions = if @tournament
        TournamentChampion.for_tournament(@tournament)
          .completed
          .includes(tournament_champion_credits: :class_cohort)
          .ordered
          .to_a
          .uniq(&:id)
      else
        []
      end

      tournament_outcomes = if @tournament
        games_scope = @tournament.games
        {
          tournament: @tournament.api_json,
          teamsCount: @tournament.teams.count,
          divisionsCount: @tournament.divisions.active.count,
          poolGamesCount: games_scope.pool_games.count,
          playoffGamesCount: games_scope.playoff_games.count,
          otherGamesCount: games_scope.where.not(phase: %w[pool playoff]).count,
          scoreCoverage: Standings::Coverage.for(@tournament),
          champions: champions.map(&:api_json)
        }
      else
        {
          tournament: nil,
          teamsCount: 0,
          divisionsCount: 0,
          poolGamesCount: 0,
          playoffGamesCount: 0,
          otherGamesCount: 0,
          scoreCoverage: Standings::Coverage.empty_payload,
          champions: []
        }
      end

      {
        generatedAt: Time.current.iso8601,
        campaign: @campaign.admin_json,
        tournamentOutcomes: tournament_outcomes,
        finance: finance,
        compliance: {
          liveExpensesCount: closeout[:liveExpensesCount],
          expensesMissingReceiptCount: closeout[:missingReceiptsCount],
          pendingReimbursementsCount: closeout[:pendingReimbursementsCount],
          openCashPledgesCount: closeout[:openCashPledgesCount],
          voidedEntriesCount: closeout[:voidedEntriesCount],
          auditEventsCount: closeout[:auditEventsCount],
          unfinalizedGamesCount: closeout[:unfinalizedGamesCount],
          championsRecordedCount: closeout[:championsRecordedCount],
          readyToArchive: closeout[:ready],
          blockers: closeout[:blockers],
          warnings: closeout[:warnings]
        }
      }
    end
  end
end
