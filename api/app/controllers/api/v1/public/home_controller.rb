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
              latestNews: [],
              gameDayNote: nil,
              predictionPolls: []
            }
          end

          today_range = Time.zone.now.beginning_of_day..Time.zone.now.end_of_day
          games_scope = tournament.games.includes(:division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] })
          today_games = games_scope.where(start_time: today_range).ordered.limit(20).to_a
          live_games = games_scope.where(status: "live").ordered.limit(10).to_a
          game_day_note = tournament.game_day_notes.find_by(date: Time.zone.today, active: true)
          polls = relevant_polls(tournament, today_games).to_a

          render json: {
            tournament: tournament.api_json,
            upcomingOrLiveTournament: context[:upcoming_or_live]&.api_json,
            latestResultsTournament: context[:latest_completed_with_games]&.api_json,
            todayGames: today_games.map(&:api_json),
            liveGames: live_games.map(&:api_json),
            latestNews: tournament.article_links.includes(game: [ :division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ]).latest.limit(5).map(&:api_json),
            gameDayNote: game_day_note&.api_json,
            predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_token_hash) }
          }
        end

        private

        def relevant_polls(tournament, today_games)
          game_ids = today_games.map(&:id)
          tournament.prediction_polls
            .includes(:prediction_votes, { tournament: { teams: [ :division_record, { team_class_memberships: :class_cohort } ] } }, game: [ { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ])
            .where("poll_type = ? OR game_id IN (?)", "tournament", game_ids.presence || [ nil ])
            .ordered
        end

        def voter_token_hash
          token = request.headers["X-FD-Voter-Token"].to_s.strip
          return nil if token.blank?

          PredictionVote.token_hash(token)
        end
      end
    end
  end
end
