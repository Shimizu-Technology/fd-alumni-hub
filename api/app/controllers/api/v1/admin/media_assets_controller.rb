module Api
  module V1
    module Admin
      class MediaAssetsController < BaseController
        before_action :require_admin!, only: [ :destroy ]

        def index
          media_assets = MediaAsset.includes(:tournament, game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest
          media_assets = authorize_collection_scope(media_assets, "history_and_media")
          return if performed?
          render json: { mediaAssets: media_assets.limit(300).map(&:api_json) }
        end

        def show
          media_asset = MediaAsset.find(params[:id])
          return unless authorize_tournament!("history_and_media", "view", media_asset.tournament_id)

          render_record media_asset, key: :mediaAsset
        end

        def create
          media_asset = MediaAsset.new(media_asset_params)
          return unless authorize_tournament!("history_and_media", "edit", media_asset.tournament_id)

          if media_asset.save
            render_record media_asset, key: :mediaAsset, status: :created
          else
            render_errors media_asset
          end
        end

        def update
          media_asset = MediaAsset.find(params[:id])
          return unless authorize_tournament!("history_and_media", "edit", media_asset.tournament_id)

          attrs = media_asset_params
          return if attrs.key?(:tournament_id) && !authorize_tournament!("history_and_media", "edit", attrs[:tournament_id])

          if media_asset.update(attrs)
            render_record media_asset, key: :mediaAsset
          else
            render_errors media_asset
          end
        end

        def destroy
          media_asset = MediaAsset.find(params[:id])
          return unless authorize_tournament!("history_and_media", "edit", media_asset.tournament_id)

          media_asset.destroy!
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
            :takenAt,
            :media_type, :mediaType,
            :video_url, :videoUrl,
            :video_provider, :videoProvider,
            :external_video_id, :externalVideoId,
            :duration_seconds, :durationSeconds,
            :division_slug, :divisionSlug
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
          assign_param(attrs, permitted, :media_type, :media_type, :mediaType)
          assign_param(attrs, permitted, :video_url, :video_url, :videoUrl)
          assign_param(attrs, permitted, :video_provider, :video_provider, :videoProvider)
          assign_param(attrs, permitted, :external_video_id, :external_video_id, :externalVideoId)
          assign_param(attrs, permitted, :duration_seconds, :duration_seconds, :durationSeconds)
          assign_param(attrs, permitted, :division_slug, :division_slug, :divisionSlug)
          attrs
        end
      end
    end
  end
end
