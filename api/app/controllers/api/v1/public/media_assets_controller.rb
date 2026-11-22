module Api
  module V1
    module Public
      class MediaAssetsController < BaseController
        def index
          archive = params[:archive] == "true" && params[:tournamentId].blank? && params[:year].blank?
          tournament = current_tournament unless archive
          return render json: { tournament: nil, mediaAssets: [] } unless archive || tournament

          limit = integer_param(:limit, default: 60, maximum: 240)
          media_assets = archive ? archive_media : tournament_media(tournament)
          media_assets = media_assets.where(media_type: "video") if params[:mediaType] == "video"
          media_assets = media_assets.where(media_type: %w[photo gallery]) if params[:mediaType] == "photo"
          media_assets = media_assets.includes(game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest.limit(limit)

          render json: {
            tournament: tournament&.api_json,
            mediaAssets: media_assets.map(&:api_json)
          }
        end

        private

        def tournament_media(tournament)
          tournament.publicly_visible_schedule? ? tournament.media_assets : tournament.media_assets.where(game_id: nil)
        end

        def archive_media
          public_tournaments = Tournament.with_public_schedule.or(Tournament.where(id: site_context.tournament&.id))
          media = MediaAsset.where(tournament: public_tournaments)
          media.where(game_id: nil).or(media.where(tournament: Tournament.with_public_schedule))
        end
      end
    end
  end
end
