module Api
  module V1
    module Admin
      class ImportsController < BaseController
        def schedule_preview
          return unless authorize_tournament!("schedule_and_teams", "import", params[:id])
          tournament = Tournament.find(params[:id])
          overwrite_scores = ActiveModel::Type::Boolean.new.cast(params[:overwriteScores] || params[:overwrite_scores])
          if overwrite_scores && !current_user.admin?
            return render json: { error: "Only administrators may enable overwriteScores during schedule import." }, status: :forbidden
          end
          rows = permitted_schedule_rows

          result = Imports::SchedulePreview.call(
            tournament: tournament,
            rows: rows,
            content: params[:content],
            format: requested_import_format,
            default_venue: params[:defaultVenue].presence || params[:default_venue].presence || "The Jungle",
            overwrite_scores: overwrite_scores
          )

          render json: result
        rescue Imports::ScheduleParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def schedule_commit
          return unless authorize_tournament!("schedule_and_teams", "import", params[:id])
          tournament = Tournament.find(params[:id])
          overwrite_scores = ActiveModel::Type::Boolean.new.cast(params[:overwriteScores] || params[:overwrite_scores])

          if overwrite_scores && !current_user.admin?
            return render json: { error: "Only administrators may enable overwriteScores during schedule import." }, status: :forbidden
          end

          rows = permitted_schedule_rows
          return unless authorize_schedule_import_rows!(tournament, rows)

          result = Imports::ScheduleCommit.call(
            tournament: tournament,
            rows: rows,
            overwrite_scores: overwrite_scores,
            actor: current_user,
            default_venue: params[:defaultVenue].presence || params[:default_venue].presence || "The Jungle"
          )

          render json: result, status: :ok
        rescue Imports::ScheduleParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        rescue Imports::ScheduleCommit::ValidationError => e
          render json: { error: e.message, preview: e.preview }, status: :unprocessable_entity
        rescue ActiveRecord::StaleObjectError
          render json: { error: "A game was updated while committing this import. Please preview again and retry." }, status: :conflict
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A duplicate game number or team entry prevented committing this import." ] }, status: :unprocessable_entity
        end

        def roster_preview
          return unless authorize_tournament!("schedule_and_teams", "import", params[:id])
          tournament = Tournament.find(params[:id])
          rows = permitted_roster_rows

          result = Imports::RosterPreview.call(
            tournament: tournament,
            rows: rows,
            content: params[:content],
            format: requested_import_format
          )

          render json: result
        rescue Imports::RosterParser::ParseError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def roster_commit
          return unless authorize_tournament!("schedule_and_teams", "import", params[:id])
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

        def authorize_schedule_import_rows!(tournament, rows)
          return true unless rows.is_a?(Array)

          has_bracket_fields = rows.any? do |row|
            %w[bracketCode bracket_code bracketRound bracket_round bracketSlot bracket_slot].any? { |key| row[key].present? }
          end
          if has_bracket_fields && !authorize_tournament!("brackets", "edit", tournament.id)
            return false
          end

          has_score_fields = rows.any? do |row|
            %w[homeScore home_score awayScore away_score].any? { |key| row[key].present? } || row["status"].to_s.strip.downcase == "final"
          end
          if has_score_fields && !authorize_tournament!("scores_and_stats", "edit", tournament.id)
            return false
          end

          true
        end

        def requested_import_format
          body_format = request.request_parameters["format"] || params[:importFormat] || params[:import_format]
          body_format.to_s.strip.presence || "auto"
        end

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
