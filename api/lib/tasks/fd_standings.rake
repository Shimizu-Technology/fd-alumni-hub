require "json"

namespace :fd do
  namespace :standings do
    desc "Recompute standings excluding placeholder, father-son, playoff, and Special games (DRY_RUN=1 to preview, YEAR=YYYY to scope)"
    task recompute_all: :environment do
      dry_run = ENV["DRY_RUN"] == "1"
      scope = Tournament.order(year: :desc, id: :asc)
      scope = scope.where(year: ENV["YEAR"].to_i) if ENV["YEAR"].present?

      report = scope.map do |tournament|
        before_rows = tournament.standings.count
        all_teams = tournament.teams.includes(:division_record).to_a
        eligible_teams = all_teams.reject(&:excluded_from_standings?)
        eligible_team_ids = eligible_teams.map(&:id).to_set
        final_games = tournament.games.finals.includes(:division_record, home_team: :division_record, away_team: :division_record).to_a
        counted_games = final_games.select do |game|
          game.counts_toward_standings? && eligible_team_ids.include?(game.home_team_id) && eligible_team_ids.include?(game.away_team_id)
        end

        if dry_run
          {
            tournamentId: tournament.id.to_s,
            year: tournament.year,
            dryRun: true,
            beforeStandingRows: before_rows,
            projectedStandingRows: eligible_teams.length,
            excludedTeams: all_teams.length - eligible_teams.length,
            countedFinalGames: counted_games.length,
            excludedFinalGames: final_games.length - counted_games.length
          }
        else
          result = Standings::Recompute.call(tournament)
          {
            tournamentId: tournament.id.to_s,
            year: tournament.year,
            dryRun: false,
            beforeStandingRows: before_rows,
            afterStandingRows: result.teams,
            excludedTeams: result.excluded_teams,
            countedFinalGames: result.games,
            excludedFinalGames: result.excluded_games
          }
        end
      end

      puts JSON.pretty_generate(dryRun: dry_run, tournaments: report)
    end
  end
end
