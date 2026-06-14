module Api
  module V1
    module Admin
      class LinksController < BaseController
        def index
          tournament = admin_tournament
          games = tournament ? games_scope(tournament).limit(500) : Game.none
          render json: { tournament: tournament&.api_json, games: games.map(&:api_json) }
        end

        def missing
          tournament = admin_tournament
          games = tournament ? games_scope(tournament).to_a : []

          missing_tickets = games.select { |game| game.ticket_url.blank? }
          missing_streams = games.select { |game| game.stream_url.blank? }
          missing_scores = games.select { |game| game.status == "final" && (game.home_score.nil? || game.away_score.nil?) }

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
          updates = bulk_link_updates
          return render json: { errors: [ "updates must be an array" ] }, status: :bad_request unless updates

          changed = []
          errors = []

          Game.transaction do
            updates.each do |payload|
              id = payload[:id]
              attrs = bulk_link_attrs(payload)

              if id.blank?
                errors << { id: nil, errors: [ "id is required" ] }
                next
              end

              if attrs.empty?
                errors << { id: id, errors: [ "ticketUrl or streamUrl is required" ] }
                next
              end

              game = Game.find(id)
              game.update!(attrs)
              changed << game
            rescue ActiveRecord::RecordNotFound
              errors << { id: id, errors: [ "Game not found" ] }
            rescue ActiveRecord::RecordInvalid => e
              errors << { id: id, errors: e.record.errors.full_messages }
            end

            raise ActiveRecord::Rollback if errors.any?
          end

          if errors.any?
            render json: { errors: errors }, status: :unprocessable_entity
          else
            render json: { updated: changed.length, games: changed.map(&:api_json) }
          end
        end

        private

        def bulk_link_updates
          raw_updates = params[:updates]
          return unless raw_updates.is_a?(Array)

          raw_updates.map do |payload|
            raw_hash = payload.respond_to?(:to_unsafe_h) ? payload.to_unsafe_h : payload
            raw_hash = {} unless raw_hash.is_a?(Hash)
            ActionController::Parameters.new(raw_hash).permit(:id, :ticket_url, :ticketUrl, :stream_url, :streamUrl)
          end
        end

        def bulk_link_attrs(payload)
          attrs = {}
          assign_param(attrs, payload, :ticket_url, :ticket_url, :ticketUrl)
          assign_param(attrs, payload, :stream_url, :stream_url, :streamUrl)
          attrs
        end

        def games_scope(tournament)
          tournament.games.includes(:division_record, home_team: :division_record, away_team: :division_record).ordered
        end
      end
    end
  end
end
