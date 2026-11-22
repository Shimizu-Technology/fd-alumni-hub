module Standings
  class Recompute
    Result = Struct.new(:teams, :games, :excluded_teams, :excluded_games, keyword_init: true)
    Plan = Struct.new(:eligible_teams, :excluded_teams, :counted_games, :excluded_games, keyword_init: true)

    def self.call(tournament)
      new(tournament).call
    end

    def self.plan(tournament)
      new(tournament).plan
    end

    def initialize(tournament)
      @tournament = tournament
    end

    def plan
      all_teams = @tournament.teams.includes(:division_record).to_a
      eligible_teams = []
      excluded_teams = []
      all_teams.each do |team|
        reason = team.standings_exclusion_reason
        if reason
          excluded_teams << { team: team, reason: reason }
        else
          eligible_teams << team
        end
      end

      eligible_team_ids = eligible_teams.map(&:id).to_set
      all_final_games = @tournament.games.finals.includes(:division_record, home_team: :division_record, away_team: :division_record).to_a
      counted_games = []
      excluded_games = []
      all_final_games.each do |game|
        reason = game.standings_exclusion_reason
        if reason.nil? && eligible_team_ids.include?(game.home_team_id) && eligible_team_ids.include?(game.away_team_id)
          counted_games << game
        else
          excluded_games << { game: game, reason: reason || "ineligible_team" }
        end
      end

      Plan.new(
        eligible_teams: eligible_teams,
        excluded_teams: excluded_teams,
        counted_games: counted_games,
        excluded_games: excluded_games
      )
    end

    def call
      Audit::Context.with { perform }
    end

    private def perform
      recompute_plan = nil

      @tournament.with_lock do
        recompute_plan = plan

        rows_by_team_id = recompute_plan.eligible_teams.to_h do |team|
          [ team.id, { wins: 0, losses: 0, points_for: 0, points_against: 0 } ]
        end

        recompute_plan.counted_games.each do |game|
          home = rows_by_team_id[game.home_team_id]
          away = rows_by_team_id[game.away_team_id]

          home[:points_for] += game.home_score
          home[:points_against] += game.away_score
          away[:points_for] += game.away_score
          away[:points_against] += game.home_score

          if game.home_score > game.away_score
            home[:wins] += 1
            away[:losses] += 1
          elsif game.away_score > game.home_score
            away[:wins] += 1
            home[:losses] += 1
          end
        end

        ranks_by_team_id = Standings::Ranker.rank_by_division(
          eligible_teams: recompute_plan.eligible_teams,
          rows_by_team_id: rows_by_team_id,
          counted_games: recompute_plan.counted_games
        )

        existing_by_team_id = @tournament.standings.index_by(&:team_id)
        eligible_team_ids = recompute_plan.eligible_teams.map(&:id)
        stale_team_ids = existing_by_team_id.keys - eligible_team_ids
        @tournament.standings.where(team_id: stale_team_ids).delete_all if stale_team_ids.any?

        recompute_plan.eligible_teams.each do |team|
          attrs = rows_by_team_id.fetch(team.id).merge(division_rank: ranks_by_team_id[team.id])
          existing = existing_by_team_id[team.id]
          if existing
            existing.assign_attributes(attrs)
            existing.save! if existing.changed?
          else
            @tournament.standings.create!(attrs.merge(team: team))
          end
        end
      end

      Result.new(
        teams: recompute_plan.eligible_teams.length,
        games: recompute_plan.counted_games.length,
        excluded_teams: recompute_plan.excluded_teams.length,
        excluded_games: recompute_plan.excluded_games.length
      )
    end
  end
end
