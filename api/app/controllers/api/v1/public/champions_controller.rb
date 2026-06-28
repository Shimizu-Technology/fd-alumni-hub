module Api
  module V1
    module Public
      class ChampionsController < BaseController
        def index
          records = TournamentChampion.includes(:tournament).ordered
          records = records.where(year: params[:year].to_i) if params[:year].present?

          render json: {
            championRecords: records.map(&:api_json),
            titleCounts: TournamentChampion.title_counts,
            entryTitleCounts: TournamentChampion.entry_title_counts
          }
        end
      end
    end
  end
end
