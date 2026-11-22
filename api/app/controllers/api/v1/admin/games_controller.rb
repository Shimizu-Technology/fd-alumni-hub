module Api
  module V1
    module Admin
      class GamesController < BaseController
        def index
          games = games_with_associations.ordered
          games = games.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          games = games.where(division: params[:division]) if params[:division].present?
          games = games.where(division_id: params[:divisionId]) if params[:divisionId].present?
          games = games.where(phase: params[:phase]) if params[:phase].present?

          render json: { games: games.limit(500).map { |g| g.api_json(include_score_audit: true) } }
        end

        def show
          game = games_with_associations.find(params[:id])
          render json: { game: game.api_json(include_score_audit: true) }
        end

        def create
          game = Game.new(game_params.except(:lock_version))

          if game.save
            render json: { game: games_with_associations.find(game.id).api_json(include_score_audit: true) }, status: :created
          else
            render_errors(game)
          end
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A game with that game number or bracket feeder slot already exists." ] }, status: :unprocessable_entity
        end

        def update
          game = Game.find(params[:id])
          incoming = game_params.except(:tournament_id)
          lock_version_param = incoming.delete(:lock_version)
          if !lock_version_param.nil? && lock_version_param.to_s.strip != ""
            game.lock_version = lock_version_param.to_i
          end
          standings_sensitive = standings_sensitive_change?(incoming)

          if game.update(incoming)
            recompute = standings_sensitive ? Standings::Recompute.call(game.tournament) : nil
            render json: {
              game: games_with_associations.find(game.id).api_json(include_score_audit: true),
              recompute: recompute && { teams: recompute.teams, games: recompute.games }
            }.compact
          else
            render_errors(game)
          end
        rescue ActiveRecord::StaleObjectError
          render json: {
            error: "This game was updated by another user. Reload to review the latest values.",
            currentGame: games_with_associations.find(game.id).api_json(include_score_audit: true)
          }, status: :conflict
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A game with that game number or bracket feeder slot already exists." ] }, status: :unprocessable_entity
        end

        private

        def games_with_associations
          Game.includes(:division_record, :score_updated_by, home_team: :division_record, away_team: :division_record)
        end

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
            :status_note,
            :statusNote,
            :phase,
            :game_number,
            :gameNumber,
            :bracket_code,
            :bracketCode,
            :bracket_round,
            :bracketRound,
            :bracket_slot,
            :bracketSlot,
            :next_game_id,
            :nextGameId,
            :next_game_slot,
            :nextGameSlot,
            :home_score,
            :homeScore,
            :away_score,
            :awayScore,
            :stream_url,
            :streamUrl,
            :ticket_url,
            :ticketUrl,
            :notes,
            :division_id,
            :divisionId,
            :division,
            :lock_version,
            :lockVersion
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :home_team_id, :home_team_id, :homeTeamId)
          assign_param(attrs, permitted, :away_team_id, :away_team_id, :awayTeamId)
          assign_param(attrs, permitted, :start_time, :start_time, :startTime)
          assign_param(attrs, permitted, :venue, :venue)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :status_note, :status_note, :statusNote)
          assign_param(attrs, permitted, :phase, :phase)
          assign_param(attrs, permitted, :game_number, :game_number, :gameNumber)
          assign_param(attrs, permitted, :bracket_code, :bracket_code, :bracketCode)
          assign_param(attrs, permitted, :bracket_round, :bracket_round, :bracketRound)
          assign_param(attrs, permitted, :bracket_slot, :bracket_slot, :bracketSlot)
          assign_param(attrs, permitted, :next_game_id, :next_game_id, :nextGameId)
          assign_param(attrs, permitted, :next_game_slot, :next_game_slot, :nextGameSlot)
          assign_param(attrs, permitted, :home_score, :home_score, :homeScore)
          assign_param(attrs, permitted, :away_score, :away_score, :awayScore)
          assign_param(attrs, permitted, :stream_url, :stream_url, :streamUrl)
          assign_param(attrs, permitted, :ticket_url, :ticket_url, :ticketUrl)
          assign_param(attrs, permitted, :notes, :notes)
          assign_param(attrs, permitted, :division_id, :division_id, :divisionId)
          assign_param(attrs, permitted, :division, :division)
          assign_param(attrs, permitted, :lock_version, :lock_version, :lockVersion)
          attrs
        end

        def standings_sensitive_change?(incoming)
          incoming.key?(:status) || incoming.key?(:home_score) || incoming.key?(:away_score) ||
            incoming.key?(:home_team_id) || incoming.key?(:away_team_id) ||
            incoming.key?(:phase) || incoming.key?(:notes) || incoming.key?(:bracket_code) ||
            incoming.key?(:division_id) || incoming.key?(:division)
        end
      end
    end
  end
end
