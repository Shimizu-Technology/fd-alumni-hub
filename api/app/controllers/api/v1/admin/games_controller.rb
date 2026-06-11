module Api
  module V1
    module Admin
      class GamesController < BaseController
        def index
          games = Game.includes(:home_team, :away_team).ordered
          games = games.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          games = games.where(division: params[:division]) if params[:division].present?

          render json: { games: games.limit(500).map(&:api_json) }
        end

        def show
          game = Game.includes(:home_team, :away_team).find(params[:id])
          render json: { game: game.api_json }
        end

        def create
          game = Game.new(game_params)

          if game.save
            render json: { game: game.api_json }, status: :created
          else
            render_errors(game)
          end
        end

        def update
          game = Game.find(params[:id])
          standings_sensitive = standings_sensitive_change?(game)

          if game.update(game_params)
            recompute = standings_sensitive ? Standings::Recompute.call(game.tournament) : nil
            render json: {
              game: Game.includes(:home_team, :away_team).find(game.id).api_json,
              recompute: recompute && { teams: recompute.teams, games: recompute.games }
            }.compact
          else
            render_errors(game)
          end
        end

        private

        def game_params
          raw = params.fetch(:game, params)
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :home_team_id,
            :homeTeamId,
            :away_team_id,
            :awayTeamId,
            :start_time,
            :startTime,
            :venue,
            :status,
            :home_score,
            :homeScore,
            :away_score,
            :awayScore,
            :stream_url,
            :streamUrl,
            :ticket_url,
            :ticketUrl,
            :notes,
            :division,
            :bracket_code,
            :bracketCode
          )

          {
            tournament_id: permitted[:tournament_id] || permitted[:tournamentId],
            home_team_id: permitted[:home_team_id] || permitted[:homeTeamId],
            away_team_id: permitted[:away_team_id] || permitted[:awayTeamId],
            start_time: permitted[:start_time] || permitted[:startTime],
            venue: permitted[:venue],
            status: permitted[:status],
            home_score: permitted[:home_score] || permitted[:homeScore],
            away_score: permitted[:away_score] || permitted[:awayScore],
            stream_url: permitted[:stream_url] || permitted[:streamUrl],
            ticket_url: permitted[:ticket_url] || permitted[:ticketUrl],
            notes: permitted[:notes],
            division: permitted[:division],
            bracket_code: permitted[:bracket_code] || permitted[:bracketCode]
          }.compact
        end

        def standings_sensitive_change?(game)
          incoming = game_params
          incoming.key?(:status) || incoming.key?(:home_score) || incoming.key?(:away_score) ||
            incoming.key?(:home_team_id) || incoming.key?(:away_team_id)
        end
      end
    end
  end
end
