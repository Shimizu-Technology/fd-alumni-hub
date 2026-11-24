module Api
  module V1
    module Public
      class HostYearsController < BaseController
        def show
          campaign = if params[:slug].blank? && params[:year].blank? && site_context.publication
            site_context.campaign
          else
            HostCampaign.resolve_public(slug: params[:slug], year: params[:year])
          end
          return render json: { error: "Host year campaign not found" }, status: :not_found unless campaign

          render json: HostCampaigns::PublicShowcase.new(campaign, mode: site_context.mode).as_json
        end
      end
    end
  end
end
