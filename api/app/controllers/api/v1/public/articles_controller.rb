module Api
  module V1
    module Public
      class ArticlesController < BaseController
        def index
          tournament = current_tournament
          return render json: { tournament: nil, articles: [] } unless tournament

          limit = integer_param(:limit, default: 50, maximum: 200)
          articles = tournament.article_links.includes(game: [ :home_team, :away_team ]).latest.limit(limit)

          render json: {
            tournament: tournament.api_json,
            articles: articles.map(&:api_json)
          }
        end
      end
    end
  end
end
