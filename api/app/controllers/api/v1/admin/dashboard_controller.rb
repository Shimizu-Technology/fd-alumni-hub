module Api
  module V1
    module Admin
      class DashboardController < BaseController
        def show
          tournament = admin_tournament

          render json: {
            tournament: tournament&.api_json,
            counts: counts_for(tournament),
            missing: missing_for(tournament),
            recentArticles: tournament ? tournament.article_links.latest.limit(5).map(&:api_json) : []
          }
        end

        private

        def counts_for(tournament)
          return empty_counts unless tournament

          {
            tournaments: Tournament.count,
            teams: tournament.teams.count,
            games: tournament.games.count,
            finalGames: tournament.games.where(status: "final").count,
            scoredGames: tournament.games.scored.count,
            articles: tournament.article_links.count,
            mediaAssets: tournament.media_assets.count,
            sponsors: tournament.sponsors.count,
            ingestItems: tournament.content_ingest_items.count
          }
        end

        def missing_for(tournament)
          return { scores: 0, streams: 0, tickets: 0 } unless tournament

          {
            scores: tournament.games.where(status: "final").where("home_score IS NULL OR away_score IS NULL").count,
            streams: tournament.games.where(stream_url: [ nil, "" ]).count,
            tickets: tournament.games.where(ticket_url: [ nil, "" ]).count
          }
        end

        def empty_counts
          {
            tournaments: Tournament.count,
            teams: 0,
            games: 0,
            finalGames: 0,
            scoredGames: 0,
            articles: 0,
            mediaAssets: 0,
            sponsors: 0,
            ingestItems: 0
          }
        end
      end
    end
  end
end
