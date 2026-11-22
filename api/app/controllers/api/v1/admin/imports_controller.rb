module Api
  module V1
    module Admin
      class ImportsController < BaseController
        def schedule_preview
          tournament = Tournament.find(params[:id])
          rows = permitted_schedule_rows

          result = Imports::SchedulePreview.call(
            tournament: tournament,
            rows: rows,
            content: params[:content],
            format: params[:format].presence || "auto",
            default_venue: params[:defaultVenue].presence || params[:default_venue].presence || "The Jungle"
          )

          render json: result
        rescue Imports::ScheduleParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def schedule_commit
          tournament = Tournament.find(params[:id])
          overwrite_scores = ActiveModel::Type::Boolean.new.cast(params[:overwriteScores] || params[:overwrite_scores])

          if overwrite_scores && !current_user.admin?
            return render json: { error: "Only administrators may enable overwriteScores during schedule import." }, status: :forbidden
          end

          rows = permitted_schedule_rows
          result = Imports::ScheduleCommit.call(
            tournament: tournament,
            rows: rows,
            overwrite_scores: overwrite_scores,
            default_venue: params[:defaultVenue].presence || params[:default_venue].presence || "The Jungle"
          )

          render json: result, status: :ok
        rescue Imports::ScheduleParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        rescue Imports::ScheduleCommit::ValidationError => e
          render json: { error: e.message, preview: e.preview }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A duplicate game number or team entry prevented committing this import." ] }, status: :unprocessable_entity
        end

        def roster_preview
          tournament = Tournament.find(params[:id])
          rows = permitted_roster_rows

          result = Imports::RosterPreview.call(
            tournament: tournament,
            rows: rows,
            content: params[:content],
            format: params[:format].presence || "auto"
          )

          render json: result
        rescue Imports::RosterParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def roster_commit
          tournament = Tournament.find(params[:id])
          rows = permitted_roster_rows

          result = Imports::RosterCommit.call(tournament: tournament, rows: rows)
          render json: result, status: :ok
        rescue Imports::RosterParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        rescue Imports::RosterCommit::ValidationError => e
          render json: { error: e.message, preview: e.preview }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A duplicate roster entry prevented committing this import." ] }, status: :unprocessable_entity
        end

        private

        def permitted_schedule_rows
          raw = params[:rows]
          return nil unless raw.is_a?(Array)

          raw.map do |entry|
            raw_hash = entry.respond_to?(:to_unsafe_h) ? entry.to_unsafe_h : entry
            raw_hash = {} unless raw_hash.is_a?(Hash)
            ActionController::Parameters.new(raw_hash).permit(
              :rowIndex, :gameNumber, :game_number, :bracketCode, :bracket_code,
              :bracketRound, :bracket_round, :bracketSlot, :bracket_slot,
              :phase, :startTime, :start_time, :awayTeam, :away_team,
              :homeTeam, :home_team, :division, :venue, :notes,
              :status, :homeScore, :home_score, :awayScore, :away_score
            ).to_h
          end
        end

        def permitted_roster_rows
          raw = params[:rows]
          return nil unless raw.is_a?(Array)

          raw.map do |entry|
            raw_hash = entry.respond_to?(:to_unsafe_h) ? entry.to_unsafe_h : entry
            raw_hash = {} unless raw_hash.is_a?(Hash)
            ActionController::Parameters.new(raw_hash).permit(
              :rowIndex, :team, :name, :jerseyNumber, :jersey_number, :position, :nickname
            ).to_h
          end
        end
      end
    end
  end
end
