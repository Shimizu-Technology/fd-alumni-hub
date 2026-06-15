module Api
  module V1
    module Admin
      class PredictionPollsController < BaseController
        def index
          tournament = admin_tournament
          polls = tournament.prediction_polls.includes(:prediction_votes, :game).ordered

          render json: { tournament: tournament.api_json, predictionPolls: polls.map(&:api_json) }
        end

        def create
          poll = PredictionPoll.new(prediction_poll_params)

          if poll.save
            render json: { predictionPoll: poll.api_json }, status: :created
          else
            render_errors(poll)
          end
        end

        def update
          poll = PredictionPoll.find(params[:id])

          if poll.update(prediction_poll_params.except(:tournament_id, :game_id, :poll_type))
            render json: { predictionPoll: poll.api_json }
          else
            render_errors(poll)
          end
        end

        private

        def prediction_poll_params
          raw = params.fetch(:predictionPoll, params.fetch(:prediction_poll, params))
          permitted = raw.permit(:tournament_id, :tournamentId, :game_id, :gameId, :poll_type, :pollType, :question, :status, :show_results, :showResults, :closes_at, :closesAt)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :game_id, :game_id, :gameId)
          assign_param(attrs, permitted, :poll_type, :poll_type, :pollType)
          assign_param(attrs, permitted, :question, :question)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :show_results, :show_results, :showResults)
          assign_param(attrs, permitted, :closes_at, :closes_at, :closesAt)
          attrs[:poll_type] ||= "game" if attrs[:game_id].present?
          attrs[:poll_type] ||= "tournament"
          attrs[:question] = default_question(attrs) if attrs[:question].blank?
          attrs
        end

        def default_question(attrs)
          return "Who wins this game?" if attrs[:poll_type] == "game"

          "Who wins the tournament?"
        end
      end
    end
  end
end
