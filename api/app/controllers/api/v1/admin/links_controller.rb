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
          updates = params.fetch(:updates, [])
          changed = []
          errors = []

          Game.transaction do
            updates.each do |payload|
              game = Game.find(payload[:id] || payload["id"])
              attrs = {}
              assign_param(attrs, payload, :ticket_url, :ticket_url, :ticketUrl)
              assign_param(attrs, payload, :stream_url, :stream_url, :streamUrl)
              game.update!(attrs)
              changed << game
            rescue ActiveRecord::RecordInvalid => e
              errors << { id: payload[:id] || payload["id"], errors: e.record.errors.full_messages }
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

        def games_scope(tournament)
          tournament.games.includes(:home_team, :away_team).ordered
        end
      end
    end
  end
end
