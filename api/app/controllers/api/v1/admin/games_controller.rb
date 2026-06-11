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
          incoming = game_params
          standings_sensitive = standings_sensitive_change?(incoming)

          if game.update(incoming)
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

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :home_team_id, :home_team_id, :homeTeamId)
          assign_param(attrs, permitted, :away_team_id, :away_team_id, :awayTeamId)
          assign_param(attrs, permitted, :start_time, :start_time, :startTime)
          assign_param(attrs, permitted, :venue, :venue)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :home_score, :home_score, :homeScore)
          assign_param(attrs, permitted, :away_score, :away_score, :awayScore)
          assign_param(attrs, permitted, :stream_url, :stream_url, :streamUrl)
          assign_param(attrs, permitted, :ticket_url, :ticket_url, :ticketUrl)
          assign_param(attrs, permitted, :notes, :notes)
          assign_param(attrs, permitted, :division, :division)
          assign_param(attrs, permitted, :bracket_code, :bracket_code, :bracketCode)
          attrs
        end

        def assign_param(attrs, permitted, target_key, *source_keys)
          source_keys.each do |source_key|
            next unless permitted.key?(source_key)

            attrs[target_key] = permitted[source_key]
            return
          end
        end

        def standings_sensitive_change?(incoming)
          incoming.key?(:status) || incoming.key?(:home_score) || incoming.key?(:away_score) ||
            incoming.key?(:home_team_id) || incoming.key?(:away_team_id)
        end
      end
    end
  end
end
