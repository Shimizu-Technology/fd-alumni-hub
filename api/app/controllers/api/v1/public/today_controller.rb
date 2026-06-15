module Api
  module V1
    module Public
      class TodayController < BaseController
        def show
          tournament = current_tournament
          return render_not_found("Tournament not found") unless tournament

          day = requested_date || Time.zone.today
          games = tournament.games
            .includes(:division_record, home_team: [ :division_record, :roster_entries ], away_team: [ :division_record, :roster_entries ])
            .where(start_time: day.beginning_of_day..day.end_of_day)
            .ordered
          note = tournament.game_day_notes.active.find_by(date: day)
          polls = relevant_polls(tournament, games)
          voter_hash = voter_token_hash

          render json: {
            tournament: tournament.api_json,
            date: day.iso8601,
            gameDayNote: note&.api_json,
            games: games.map { |game| game.api_json(include_rosters: true) },
            predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_hash) },
            sponsors: tournament.sponsors.active.ordered.limit(4).map(&:api_json),
            lastUpdatedAt: [ note&.updated_at, games.map(&:updated_at).max, polls.map(&:updated_at).max ].compact.max&.iso8601
          }
        end

        private

        def requested_date
          return nil if params[:date].blank?

          Date.iso8601(params[:date])
        rescue ArgumentError
          nil
        end

        def relevant_polls(tournament, games)
          game_ids = games.map(&:id)
          tournament.prediction_polls.includes(:prediction_votes, :game).where("poll_type = ? OR game_id IN (?)", "tournament", game_ids.presence || [ nil ]).ordered
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
