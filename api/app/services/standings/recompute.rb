module Standings
  class Recompute
    Result = Struct.new(:teams, :games, :excluded_teams, :excluded_games, keyword_init: true)

    def self.call(tournament)
      new(tournament).call
    end

    def initialize(tournament)
      @tournament = tournament
    end

    def call
      all_teams = @tournament.teams.includes(:division_record).to_a
      eligible_teams = all_teams.reject(&:excluded_from_standings?)
      all_final_games = @tournament.games.finals.includes(:division_record, home_team: :division_record, away_team: :division_record).to_a
      eligible_games = all_final_games.select(&:counts_toward_standings?)

      rows_by_team_id = eligible_teams.to_h do |team|
        [ team.id, { wins: 0, losses: 0, points_for: 0, points_against: 0 } ]
      end

      counted_games = 0
      eligible_games.each do |game|
        home = rows_by_team_id[game.home_team_id]
        away = rows_by_team_id[game.away_team_id]
        next unless home && away

        counted_games += 1
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

      Standing.transaction do
        @tournament.standings.delete_all
        eligible_teams.each do |team|
          @tournament.standings.create!(rows_by_team_id.fetch(team.id).merge(team: team))
        end
      end

      Result.new(
        teams: eligible_teams.length,
        games: counted_games,
        excluded_teams: all_teams.length - eligible_teams.length,
        excluded_games: all_final_games.length - counted_games
      )
    end
  end
end
