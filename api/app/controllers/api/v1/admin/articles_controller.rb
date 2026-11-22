module Api
  module V1
    module Admin
      class ArticlesController < BaseController
        before_action :require_admin!, only: [ :destroy ]

        def index
          articles = ArticleLink.includes(:tournament, game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest
          articles = authorize_collection_scope(articles, "history_and_media")
          return if performed?
          render json: { articles: articles.limit(300).map(&:api_json) }
        end

        def show
          article = ArticleLink.find(params[:id])
          return unless authorize_tournament!("history_and_media", "view", article.tournament_id)

          render_record article, key: :article
        end

        def create
          article = ArticleLink.new(article_params)
          return unless authorize_tournament!("history_and_media", "edit", article.tournament_id)

          if article.save
            render_record article, key: :article, status: :created
          else
            render_errors article
          end
        end

        def update
          article = ArticleLink.find(params[:id])
          return unless authorize_tournament!("history_and_media", "edit", article.tournament_id)

          attrs = article_params
          return if attrs.key?(:tournament_id) && !authorize_tournament!("history_and_media", "edit", attrs[:tournament_id])

          if article.update(attrs)
            render_record article, key: :article
          else
            render_errors article
          end
        end

        def destroy
          article = ArticleLink.find(params[:id])
          return unless authorize_tournament!("history_and_media", "edit", article.tournament_id)

          article.destroy!
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
