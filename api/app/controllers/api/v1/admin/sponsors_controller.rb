module Api
  module V1
    module Admin
      class SponsorsController < BaseController
        before_action :require_admin!, only: [ :destroy ]

        def index
          ids = access_policy.scope_ids("tournament", capability: "fundraisers_and_sponsors", action: "view")
          site_access = access_policy.allows?("fundraisers_and_sponsors", "view")
          return render_forbidden unless site_access || ids.any?
          return render_forbidden if !site_access && params[:tournamentId].present? && !ids.include?(params[:tournamentId].to_i)

          sponsors = Sponsor.includes(:tournament).ordered_by_tier
          sponsors = sponsors.where(tournament_id: ids) unless site_access
          sponsors = sponsors.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          render json: { sponsors: sponsors.limit(300).map(&:api_json) }
        end

        def show
          sponsor = Sponsor.find(params[:id])
          return unless authorize_tournament!("fundraisers_and_sponsors", "view", sponsor.tournament_id)

          render_record sponsor, key: :sponsor
        end

        def create
          sponsor = Sponsor.new(sponsor_params)
          return unless authorize_tournament!("fundraisers_and_sponsors", "edit", sponsor.tournament_id)

          if sponsor.save
            render_record sponsor, key: :sponsor, status: :created
          else
            render_errors sponsor
          end
        end

        def update
          sponsor = Sponsor.find(params[:id])
          return unless authorize_tournament!("fundraisers_and_sponsors", "edit", sponsor.tournament_id)
          target = sponsor_params
          return if target.key?(:tournament_id) && !authorize_tournament!("fundraisers_and_sponsors", "edit", target[:tournament_id])


          if sponsor.update(sponsor_params)
            render_record sponsor, key: :sponsor
          else
            render_errors sponsor
          end
        end

        def destroy
          sponsor = Sponsor.find(params[:id])
          return unless authorize_tournament!("fundraisers_and_sponsors", "edit", sponsor.tournament_id)

          sponsor.destroy!
          head :no_content
        end

        private

        def sponsor_params
          raw = params.fetch(:sponsor, params)
          permitted = raw.permit(:tournament_id, :tournamentId, :name, :logo_url, :logoUrl, :target_url, :targetUrl, :tier, :description, :active, :position)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :logo_url, :logo_url, :logoUrl)
          assign_param(attrs, permitted, :target_url, :target_url, :targetUrl)
          assign_param(attrs, permitted, :tier, :tier)
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :active, :active)
          assign_param(attrs, permitted, :position, :position)
          attrs
        end
      end
    end
  end
end
