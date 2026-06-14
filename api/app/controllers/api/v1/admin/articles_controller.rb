module Api
  module V1
    module Admin
      class ArticlesController < BaseController
        def index
          articles = ArticleLink.includes(:tournament, game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest
          articles = articles.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          render json: { articles: articles.limit(300).map(&:api_json) }
        end

        def show
          render_record ArticleLink.find(params[:id]), key: :article
        end

        def create
          article = ArticleLink.new(article_params)

          if article.save
            render_record article, key: :article, status: :created
          else
            render_errors article
          end
        end

        def update
          article = ArticleLink.find(params[:id])

          if article.update(article_params)
            render_record article, key: :article
          else
            render_errors article
          end
        end

        def destroy
          ArticleLink.find(params[:id]).destroy!
          head :no_content
        end

        private

        def article_params
          raw = params.fetch(:article, params)
          permitted = raw.permit(:tournament_id, :tournamentId, :game_id, :gameId, :title, :source, :url, :published_at, :publishedAt, :image_url, :imageUrl, :excerpt)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :game_id, :game_id, :gameId)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :source, :source)
          assign_param(attrs, permitted, :url, :url)
          assign_param(attrs, permitted, :published_at, :published_at, :publishedAt)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :excerpt, :excerpt)
          attrs
        end
      end
    end
  end
end
