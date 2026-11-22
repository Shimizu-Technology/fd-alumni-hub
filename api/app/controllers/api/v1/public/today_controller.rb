module Api
  module V1
    module Public
      class TodayController < BaseController
        def show
          tournament = current_tournament
          return render_not_found("Tournament not found") unless tournament

          day = params[:date].blank? ? Time.zone.today : Tonight::Payload.parse_date(params[:date])
          campaign = if params[:tournamentId].blank? && params[:year].blank? && site_context.publication
            site_context.campaign
          else
            Tonight::Payload.campaign_for(tournament)
          end
          campaign = nil if campaign && campaign.tournament_id != tournament.id

          render json: Tonight::Payload.call(tournament: tournament, day: day, campaign: campaign,
            alerts: site_context.alerts(tournament).to_a, voter_hash: voter_token_hash)
        rescue ArgumentError
          render json: { errors: [ "Date must be a valid YYYY-MM-DD date" ] }, status: :unprocessable_entity
        end

        private

        def voter_token_hash
          token = request.headers["X-FD-Voter-Token"].to_s.strip
          return nil if token.blank?

          PredictionVote.token_hash(token)
        end
      end
    end
  end
end
