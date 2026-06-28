module Api
  module V1
    module Public
      class TodayController < BaseController
        def show
          tournament = current_tournament
          return render_not_found("Tournament not found") unless tournament

          day = requested_date || Time.zone.today
          games = tournament.games
            .includes(:division_record, home_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ])
            .where(start_time: day.beginning_of_day..day.end_of_day)
            .ordered
            .to_a
          note = tournament.game_day_notes.active.find_by(date: day)
          polls = relevant_polls(tournament, games).to_a
          voter_hash = voter_token_hash
          last_updated_at = latest_updated_at(note, games, polls)

          render json: {
            tournament: tournament.api_json,
            date: day.iso8601,
            gameDayNote: note&.api_json,
            games: games.map { |game| game.api_json(include_rosters: true) },
            predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_hash) },
            sponsors: tournament.sponsors.active.ordered.limit(4).map(&:api_json),
            lastUpdatedAt: last_updated_at&.iso8601
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
          tournament.prediction_polls
            .includes(:prediction_votes, { tournament: { teams: [ :division_record, { team_class_memberships: :class_cohort } ] } }, game: [ { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ])
            .where("poll_type = ? OR game_id IN (?)", "tournament", game_ids.presence || [ nil ])
            .ordered
        end

        def latest_updated_at(*record_groups)
          record_groups.flatten.compact.filter_map(&:updated_at).max
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
