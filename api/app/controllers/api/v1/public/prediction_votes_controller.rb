module Api
  module V1
    module Public
      class PredictionVotesController < BaseController
        def create
          poll = prediction_poll_for_vote(params[:prediction_poll_id])
          token = vote_params[:voterToken].to_s.strip
          return render json: { error: "Voter token is required" }, status: :unprocessable_entity if token.blank?

          vote = persist_vote(poll, PredictionVote.token_hash(token), vote_params[:teamId])

          if vote.errors.empty?
            render json: { predictionPoll: prediction_poll_for_response(poll.id).api_json(voter_token_hash: vote.voter_token_hash) }
          else
            render json: { errors: vote.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def vote_params
          raw = params.fetch(:predictionVote, params)
          raw.permit(:teamId, :team_id, :voterToken, :voter_token).tap do |permitted|
            permitted[:teamId] ||= permitted[:team_id]
            permitted[:voterToken] ||= permitted[:voter_token]
          end
        end

        def persist_vote(poll, voter_token_hash, team_id)
          vote = poll.prediction_votes.find_or_initialize_by(voter_token_hash: voter_token_hash)
          vote.team_id = team_id
          vote.save
          vote
        rescue ActiveRecord::RecordNotUnique
          vote = poll.prediction_votes.find_by!(voter_token_hash: voter_token_hash)
          vote.team_id = team_id
          vote.save
          vote
        end

        def prediction_poll_for_vote(id)
          PredictionPoll
            .includes({ tournament: { teams: :division_record } }, game: [ :home_team, :away_team ])
            .find(id)
        end

        def prediction_poll_for_response(id)
          PredictionPoll
            .includes(:prediction_votes, { tournament: { teams: :division_record } }, game: [ { home_team: :division_record }, { away_team: :division_record } ])
            .find(id)
        end
      end
    end
  end
end
