module Api
  module V1
    module Public
      class HostYearsController < BaseController
        def show
          campaign = HostCampaign.resolve_public(slug: params[:slug], year: params[:year])
          return render json: { error: "Host year campaign not found" }, status: :not_found unless campaign

          events = campaign.campaign_events.public_listing.ordered.to_a
          posts = campaign.campaign_posts.published.includes(:author).ordered.limit(50).to_a

          render json: {
            campaign: campaign.public_json,
            events: events.map(&:public_json),
            posts: posts.map(&:public_json),
            hafapass: {
              available: false,
              stale: false,
              fetchedAt: nil,
              events: []
            }
          }
        end
      end
    end
  end
end
