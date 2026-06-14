module Api
  module V1
    module Public
      class MediaAssetsController < BaseController
        def index
          tournament = current_tournament
          return render json: { tournament: nil, mediaAssets: [] } unless tournament

          limit = integer_param(:limit, default: 60, maximum: 240)
          media_assets = tournament.media_assets.includes(game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest.limit(limit)

          render json: {
            tournament: tournament.api_json,
            mediaAssets: media_assets.map(&:api_json)
          }
        end
      end
    end
  end
end
