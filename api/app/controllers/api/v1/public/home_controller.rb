module Api
  module V1
    module Public
      class HomeController < BaseController
        def show
          context = Tournament.home_context
          tournament = Tournament.active_for_public(context)

          unless tournament
            return render json: {
              tournament: nil,
              upcomingOrLiveTournament: context[:upcoming_or_live]&.api_json,
              latestResultsTournament: context[:latest_completed_with_games]&.api_json,
              todayGames: [],
              liveGames: [],
              latestNews: []
            }
          end

          today_range = Time.zone.now.beginning_of_day..Time.zone.now.end_of_day
          games_scope = tournament.games.includes(:home_team, :away_team)

          render json: {
            tournament: tournament.api_json,
            upcomingOrLiveTournament: context[:upcoming_or_live]&.api_json,
            latestResultsTournament: context[:latest_completed_with_games]&.api_json,
            todayGames: games_scope.where(start_time: today_range).ordered.limit(20).map(&:api_json),
            liveGames: games_scope.where(status: "live").ordered.limit(10).map(&:api_json),
            latestNews: tournament.article_links.includes(game: [ :home_team, :away_team ]).latest.limit(5).map(&:api_json)
          }
        end
      end
    end
  end
end
