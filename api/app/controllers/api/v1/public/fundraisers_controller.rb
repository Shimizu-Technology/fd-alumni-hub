module Api
  module V1
    module Public
      class FundraisersController < BaseController
        def show
          event = CampaignEvent.public_listing.joins(:host_campaign).merge(HostCampaign.publicly_visible).find_by(id: params[:id])
          return render_not_found("Fundraiser not found") unless event

          campaign = event.host_campaign
          merged = HostCampaigns::PublicShowcase.new(campaign).with_tickets([ event ])
          render json: { event: merged[:events].first, campaign: campaign.public_json, hafapass: merged[:hafapass].except(:events) }
        end
      end
    end
  end
end
