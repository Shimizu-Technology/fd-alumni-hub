module Api
  module V1
    module Public
      class ArticlesController < BaseController
        def index
          archive = params[:archive] == "true" && params[:tournamentId].blank? && params[:year].blank?
          tournament = current_tournament unless archive
          return render json: { tournament: nil, articles: [], availableYears: [] } unless archive || tournament

          limit = integer_param(:limit, default: 50, maximum: 200)
          articles = archive ? archive_articles : tournament_articles(tournament)
          articles = articles.includes(:tournament, game: [ :division_record, { home_team: :division_record, away_team: :division_record } ]).latest.limit(limit)
          available_years = archive_articles.joins(:tournament).distinct.order("tournaments.year DESC").pluck("tournaments.year")

          render json: {
            tournament: tournament&.api_json,
            articles: articles.map(&:api_json),
            availableYears: available_years
          }
        end

        private

        def tournament_articles(tournament)
          tournament.publicly_visible_schedule? ? tournament.article_links : tournament.article_links.where(game_id: nil)
        end

        def archive_articles
          public_tournaments = Tournament.with_public_schedule.or(Tournament.where(id: site_context.tournament&.id))
          scoped = ArticleLink.where(tournament: public_tournaments)
          scoped.where(game_id: nil).or(scoped.where(tournament: Tournament.with_public_schedule))
        end
      end
    end
  end
end
