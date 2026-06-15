module Api
  module V1
    module Admin
      class GameDayNotesController < BaseController
        def index
          tournament = admin_tournament
          date = requested_date || Time.zone.today
          note = tournament.game_day_notes.find_by(date: date)
          games = tournament.games.includes(:division_record, home_team: :division_record, away_team: :division_record).where(start_time: date.beginning_of_day..date.end_of_day).ordered

          render json: {
            tournament: tournament.api_json,
            date: date.iso8601,
            gameDayNote: note&.api_json,
            games: games.map(&:api_json),
            predictionPolls: tournament.prediction_polls.includes(:prediction_votes, :game).ordered.map(&:api_json)
          }
        end

        def create
          tournament = admin_tournament
          attrs = note_params.merge(tournament: tournament)
          note = tournament.game_day_notes.find_or_initialize_by(date: attrs[:date] || Time.zone.today)
          created = note.new_record?

          if note.update(attrs.except(:date))
            render json: { gameDayNote: note.api_json }, status: created ? :created : :ok
          else
            render_errors(note)
          end
        end

        def update
          note = GameDayNote.find(params[:id])

          if note.update(note_params.except(:date, :tournament_id))
            render json: { gameDayNote: note.api_json }
          else
            render_errors(note)
          end
        end

        private

        def requested_date
          return nil if params[:date].blank?

          Date.iso8601(params[:date])
        rescue ArgumentError
          nil
        end

        def note_params
          raw = params.fetch(:gameDayNote, params.fetch(:game_day_note, params))
          permitted = raw.permit(:tournament_id, :tournamentId, :date, :host_class, :hostClass, :food_menu, :foodMenu, :announcement, :sponsor_shoutout, :sponsorShoutout, :active)

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :date, :date)
          assign_param(attrs, permitted, :host_class, :host_class, :hostClass)
          assign_param(attrs, permitted, :food_menu, :food_menu, :foodMenu)
          assign_param(attrs, permitted, :announcement, :announcement)
          assign_param(attrs, permitted, :sponsor_shoutout, :sponsor_shoutout, :sponsorShoutout)
          assign_param(attrs, permitted, :active, :active)
          attrs[:date] = Date.iso8601(attrs[:date]) if attrs[:date].is_a?(String) && attrs[:date].present?
          attrs
        end
      end
    end
  end
end
