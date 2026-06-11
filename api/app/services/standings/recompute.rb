module Standings
  class Recompute
    Result = Struct.new(:teams, :games, keyword_init: true)

    def self.call(tournament)
      new(tournament).call
    end

    def initialize(tournament)
      @tournament = tournament
    end

    def call
      teams = @tournament.teams.to_a
      final_games = @tournament.games.finals.to_a

      rows = teams.index_with do
        { wins: 0, losses: 0, points_for: 0, points_against: 0 }
      end

      final_games.each do |game|
        home = rows[game.home_team]
        away = rows[game.away_team]
        next unless home && away

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
        rows.each do |team, values|
          @tournament.standings.create!(values.merge(team: team))
        end
      end

      Result.new(teams: teams.length, games: final_games.length)
    end
  end
end
