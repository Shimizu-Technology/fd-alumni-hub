module Api
  module V1
    module Public
      class TicketsController < BaseController
        def show
          requested_slug = params[:campaignSlug].to_s.strip.presence
          campaign = HostCampaign.resolve_public(slug: requested_slug, year: params[:year])

          if campaign && !HostCampaign::FEATUREABLE_STATUSES.include?(campaign.status)
            campaign = nil
          end

          if requested_slug.present? && campaign.nil?
            return render json: { error: "Campaign not found" }, status: :not_found
          end

          tournament = campaign&.tournament || current_tournament

          ticket_data = if campaign
            begin
              Hafapass::EventsClient.for_tickets_page(campaign)
            rescue StandardError => e
              Rails.logger.warn("Public::TicketsController HafaPass fallback for campaign #{campaign.id}: #{e.class}: #{e.message}")
              Hafapass::EventsClient.empty_tickets_payload(
                all_tickets_url: Hafapass::EventsClient.all_tickets_url_for(campaign)
              )
            end
          else
            Hafapass::EventsClient.empty_tickets_payload
          end

          render json: {
            tournament: tournament&.api_json,
            campaign: campaign ? {
              slug: campaign.slug,
              title: campaign.title,
              allTicketsUrl: Hafapass::EventsClient.all_tickets_url_for(campaign)
            } : nil,
            hafapass: {
              available: ticket_data.dig(:hafapass, :available) == true,
              stale: ticket_data.dig(:hafapass, :stale) == true,
              fetchedAt: ticket_data.dig(:hafapass, :fetchedAt)
            },
            passes: ticket_data[:passes],
            gameNights: ticket_data[:gameNights],
            otherEvents: ticket_data[:otherEvents],
            fundraiserEvents: ticket_data[:fundraiserEvents],
            doorInfo: default_door_info(tournament)
          }
        end

        private

        def default_door_info(tournament)
          {
            venue: "Father Duenas Phoenix Center (Mangilao, Guam)",
            doorsOpenNote: "Doors typically open 45 minutes before the first scheduled tip-off each game night.",
            paymentNote: "Advance digital tickets and tournament passes are sold through HåfaPass. Walk-up admission is available at the Phoenix Center entrance when capacity permits.",
            reentryNote: "Keep your digital QR pass or hand stamp visible for same-night re-entry.",
            tournamentYear: tournament&.year
          }
        end
      end
    end
  end
end
