module Api
  module V1
    module Admin
      class MediaAssetsController < BaseController
        def index
          media_assets = MediaAsset.includes(:tournament, game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest
          media_assets = media_assets.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          render json: { mediaAssets: media_assets.limit(300).map(&:api_json) }
        end

        def show
          render_record MediaAsset.find(params[:id]), key: :mediaAsset
        end

        def create
          media_asset = MediaAsset.new(media_asset_params)

          if media_asset.save
            render_record media_asset, key: :mediaAsset, status: :created
          else
            render_errors media_asset
          end
        end

        def update
          media_asset = MediaAsset.find(params[:id])

          if media_asset.update(media_asset_params)
            render_record media_asset, key: :mediaAsset
          else
            render_errors media_asset
          end
        end

        def destroy
          MediaAsset.find(params[:id]).destroy!
          head :no_content
        end

        private

        def media_asset_params
          raw = params.fetch(:mediaAsset, params.fetch(:media_asset, params))
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :game_id,
            :gameId,
            :source,
            :title,
            :image_url,
            :imageUrl,
            :article_url,
            :articleUrl,
            :caption,
            :tags,
            :taken_at,
            :takenAt
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :game_id, :game_id, :gameId)
          assign_param(attrs, permitted, :source, :source)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :article_url, :article_url, :articleUrl)
          assign_param(attrs, permitted, :caption, :caption)
          assign_param(attrs, permitted, :tags, :tags)
          assign_param(attrs, permitted, :taken_at, :taken_at, :takenAt)
          attrs
        end
      end
    end
  end
end
