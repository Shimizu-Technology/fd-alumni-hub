module Api
  module V1
    module Admin
      class LinksController < BaseController
        STALE_MESSAGE = "This game was updated by another user. Reload to review the latest values.".freeze

        def index
          return unless authorize_tournament!("schedule_and_teams", "view", admin_tournament("schedule_and_teams")&.id)
          tournament = admin_tournament("schedule_and_teams")
          games = tournament ? games_scope(tournament).limit(500) : Game.none
          render json: { tournament: tournament&.api_json, games: games.map { |g| g.api_json(include_score_audit: true) } }
        end

        def missing
          return unless authorize_tournament!("schedule_and_teams", "view", admin_tournament("schedule_and_teams")&.id)
          tournament = admin_tournament("schedule_and_teams")
          games = tournament ? games_scope(tournament).to_a : []

          missing_tickets = games.select { |game| game.ticket_url.blank? }
          missing_streams = games.select { |game| game.stream_url.blank? }
          missing_scores = games.select { |game| game.status == "final" && !game.final_result? }

          render json: {
            tournament: tournament&.api_json,
            summary: {
              missingTickets: missing_tickets.length,
              missingStreams: missing_streams.length,
              missingScores: missing_scores.length
            },
            missingTickets: missing_tickets.map(&:api_json),
            missingStreams: missing_streams.map(&:api_json),
            missingScores: missing_scores.map(&:api_json)
          }
        end

        def bulk_update
          allowed = access_policy.allows?("schedule_and_teams", "edit") ||
            access_policy.scope_ids("tournament", capability: "schedule_and_teams", action: "edit").any?
          return render_forbidden unless allowed

          updates = bulk_link_updates
          return render json: { errors: [ "updates must be an array" ] }, status: :bad_request unless updates

          changed = []
          errors = []
          conflict_ids = []

          Game.transaction(requires_new: true) do
            updates.each do |payload|
              id = payload[:id]
              attrs = bulk_link_attrs(payload)
              lock_version_present = attrs.key?(:lock_version)
              lock_version_param = attrs.delete(:lock_version)

              if id.blank?
                errors << { id: nil, errors: [ "id is required" ] }
                next
              end

              if attrs.empty?
                errors << { id: id, errors: [ "ticketUrl or streamUrl is required" ] }
                next
              end

              parsed_version = nil
              if lock_version_present && !lock_version_param.nil? && lock_version_param.to_s.strip != ""
                parsed_version = parse_lock_version(lock_version_param)
                unless parsed_version
                  errors << { id: id, errors: [ "lockVersion must be a non-negative integer" ] }
                  next
                end
              end

              game = Game.find(id)
              unless authorize_tournament!("schedule_and_teams", "edit", game.tournament_id)
                raise ActiveRecord::Rollback
              end
              game.lock_version = parsed_version unless parsed_version.nil?
              game.update!(attrs)
              changed << game
            rescue ActiveRecord::RecordNotFound
              errors << { id: id, errors: [ "Game not found" ] }
            rescue ActiveRecord::RecordInvalid => e
              errors << { id: id, errors: e.record.errors.full_messages }
            rescue ActiveRecord::StaleObjectError
              conflict_ids << id
              errors << { id: id, errors: [ STALE_MESSAGE ] }
            rescue ActiveRecord::RecordNotUnique
              errors << { id: id, errors: [ "A conflicting game update already exists." ] }
            end

            raise ActiveRecord::Rollback if errors.any?
          end

          return if performed?

          if conflict_ids.any?
            # Reload current committed state AFTER rollback so reverted writes are never exposed as currentGame
            current_by_id = Game.includes(:division_record, :score_updated_by, home_team: :division_record, away_team: :division_record)
              .where(id: conflict_ids.uniq)
              .index_by { |g| g.id.to_s }
            conflicts = conflict_ids.map do |id|
              { id: id, error: STALE_MESSAGE, currentGame: current_by_id[id.to_s]&.api_json(include_score_audit: true) }
            end
            render json: {
              error: STALE_MESSAGE,
              conflicts: conflicts,
              errors: errors
            }, status: :conflict
          elsif errors.any?
            render json: { errors: errors }, status: :unprocessable_entity
          else
            # Preload associations onto the exact committed in-memory Game instances so lockVersion matches what this transaction wrote
            ActiveRecord::Associations::Preloader.new(
              records: changed,
              associations: [ :division_record, :score_updated_by, { home_team: :division_record }, { away_team: :division_record } ]
            ).call
            render json: { updated: changed.length, games: changed.map { |game| game.api_json(include_score_audit: true) } }
          end
        end

        private

        def parse_lock_version(value)
          return value if value.is_a?(Integer) && value >= 0
          return nil unless value.to_s.strip.match?(/\A\d+\z/)

          value.to_s.strip.to_i
        end

        def bulk_link_updates
          raw_updates = params[:updates]
          return unless raw_updates.is_a?(Array)

          raw_updates.map do |payload|
            raw_hash = payload.respond_to?(:to_unsafe_h) ? payload.to_unsafe_h : payload
            raw_hash = {} unless raw_hash.is_a?(Hash)
            ActionController::Parameters.new(raw_hash).permit(:id, :ticket_url, :ticketUrl, :stream_url, :streamUrl, :lock_version, :lockVersion)
          end
        end

        def bulk_link_attrs(payload)
          attrs = {}
          assign_param(attrs, payload, :ticket_url, :ticket_url, :ticketUrl)
          assign_param(attrs, payload, :stream_url, :stream_url, :streamUrl)
          assign_param(attrs, payload, :lock_version, :lock_version, :lockVersion)
          attrs
        end

        def games_scope(tournament)
          tournament.games.includes(:division_record, :score_updated_by, home_team: :division_record, away_team: :division_record).ordered
        end
      end
    end
  end
end
