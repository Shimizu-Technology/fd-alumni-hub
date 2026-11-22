require "json"

namespace :fd do
  namespace :standings do
    desc "Recompute standings excluding placeholder, father-son, playoff, and Special games (DRY_RUN=1 to preview, YEAR=YYYY or CONFIRM=1 to write)"
    task recompute_all: :environment do
      dry_run = ENV["DRY_RUN"] == "1"
      year_raw = ENV["YEAR"].presence
      confirmed = ENV["CONFIRM"] == "1"

      year_filter = nil
      if year_raw
        year_filter = Integer(year_raw, 10, exception: false)
        abort "Invalid YEAR=#{year_raw.inspect}; expected a 4-digit year (e.g. YEAR=2026)." unless year_filter&.positive?
      end

      if !dry_run && year_filter.nil? && !confirmed
        abort "Refusing to rewrite all tournaments without YEAR=YYYY or CONFIRM=1. Run with DRY_RUN=1 first to inspect exclusions."
      end

      scope = Tournament.order(year: :desc, id: :asc)
      scope = scope.where(year: year_filter) if year_filter
      tournaments = scope.to_a

      report = tournaments.map do |tournament|
        before_rows = tournament.standings.count
        if dry_run
          recompute_plan = Standings::Recompute.plan(tournament)
          {
            tournamentId: tournament.id.to_s,
            year: tournament.year,
            dryRun: true,
            beforeStandingRows: before_rows,
            projectedStandingRows: recompute_plan.eligible_teams.length,
            excludedTeamsCount: recompute_plan.excluded_teams.length,
            excludedTeams: recompute_plan.excluded_teams.map do |entry|
              team = entry[:team]
              { id: team.id.to_s, displayName: team.display_name, division: team.resolved_division, reason: entry[:reason] }
            end,
            countedFinalGames: recompute_plan.counted_games.length,
            excludedFinalGamesCount: recompute_plan.excluded_games.length,
            excludedFinalGames: recompute_plan.excluded_games.map do |entry|
              game = entry[:game]
              {
                id: game.id.to_s,
                matchup: "#{game.home_team&.display_name} vs #{game.away_team&.display_name}",
                division: game.resolved_division,
                bracketCode: game.bracket_code,
                reason: entry[:reason]
              }
            end
          }
        else
          result = Standings::Recompute.call(tournament)
          {
            tournamentId: tournament.id.to_s,
            year: tournament.year,
            dryRun: false,
            beforeStandingRows: before_rows,
            afterStandingRows: result.teams,
            excludedTeamsCount: result.excluded_teams,
            countedFinalGames: result.games,
            excludedFinalGamesCount: result.excluded_games
          }
        end
      rescue StandardError => e
        {
          tournamentId: tournament.id.to_s,
          year: tournament.year,
          dryRun: dry_run,
          error: "#{e.class}: #{e.message}"
        }
      end

      puts JSON.pretty_generate(dryRun: dry_run, tournaments: report)
    end
  end
end
