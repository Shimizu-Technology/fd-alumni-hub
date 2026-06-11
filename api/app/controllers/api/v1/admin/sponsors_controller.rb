module Api
  module V1
    module Admin
      class SponsorsController < BaseController
        def index
          sponsors = Sponsor.includes(:tournament).ordered
          sponsors = sponsors.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          render json: { sponsors: sponsors.limit(300).map(&:api_json) }
        end

        def show
          render_record Sponsor.find(params[:id]), key: :sponsor
        end

        def create
          sponsor = Sponsor.new(sponsor_params)

          if sponsor.save
            render_record sponsor, key: :sponsor, status: :created
          else
            render_errors sponsor
          end
        end

        def update
          sponsor = Sponsor.find(params[:id])

          if sponsor.update(sponsor_params)
            render_record sponsor, key: :sponsor
          else
            render_errors sponsor
          end
        end

        def destroy
          Sponsor.find(params[:id]).destroy!
          head :no_content
        end

        private

        def sponsor_params
          raw = params.fetch(:sponsor, params)
          permitted = raw.permit(:tournament_id, :tournamentId, :name, :logo_url, :logoUrl, :target_url, :targetUrl, :tier, :active, :position)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :logo_url, :logo_url, :logoUrl)
          assign_param(attrs, permitted, :target_url, :target_url, :targetUrl)
          assign_param(attrs, permitted, :tier, :tier)
          assign_param(attrs, permitted, :active, :active)
          assign_param(attrs, permitted, :position, :position)
          attrs
        end
      end
    end
  end
end
