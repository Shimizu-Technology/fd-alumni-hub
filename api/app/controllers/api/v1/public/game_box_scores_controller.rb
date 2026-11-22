module Api
  module V1
    module Public
      class GameBoxScoresController < BaseController
        def show
          # Read publication state and rows under the same shared lock.
          payload = Game.transaction do
            game = Game.lock("FOR SHARE").find(params[:id])
            next unless game.publicly_visible_box_score?

            stats = game.player_game_stats.order(:id).group_by(&:team_id)
            {
              game: game.api_json.except(:notes),
              coverage: game.box_score_coverage,
              underReview: game.box_score_status == "needs_review",
              publishedAt: game.box_score_published_at&.iso8601,
              homeStats: stats.fetch(game.home_team_id, []).map(&:public_json),
              awayStats: stats.fetch(game.away_team_id, []).map(&:public_json)
            }
          end
          payload ? render(json: payload) : render_not_found("Box score not found")
        end
      end
    end
  end
end
