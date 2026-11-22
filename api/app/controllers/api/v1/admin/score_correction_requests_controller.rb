module Api
  module V1
    module Admin
      class ScoreCorrectionRequestsController < BaseController
        include ResultParameters

        def index
          tournament = admin_tournament("scores_and_stats")
          return render_forbidden unless tournament
          return unless authorize_tournament!("scores_and_stats", "view", tournament.id)

          requests = ScoreCorrectionRequest.where(tournament: tournament)
          requests = requests.where(requested_by: current_user) unless allows_action?("correct_final", tournament.id)
          if params[:status].present?
            unless ScoreCorrectionRequest::STATUSES.include?(params[:status])
              return render json: { errors: [ "Correction request status is invalid." ] }, status: :unprocessable_entity
            end
            requests = requests.where(status: params[:status])
          end
          requests = requests.includes(:requested_by, game: [ :home_team, :away_team ]).order(created_at: :desc, id: :desc)
          render json: { correctionRequests: requests.map(&:api_json) }
        end

        def create
          game = Game.find(params[:id])
          if %w[request_correction correct_final].none? { |action| allows_action?(action, game.tournament_id) }
            return render_forbidden
          end

          attrs = result_params(params, params[:result])
          proposal = Games::RecordResult.new(game, { status: "final" }.merge(attrs.except(:start_time)))
          request = nil
          game.with_lock do
            values = proposal.proposed_attributes
            errors = proposal.validation_errors(game, values)
            if errors.any?
              return render json: { errors: errors }, status: :unprocessable_entity
            end
            request = ScoreCorrectionRequest.new(game: game, tournament: game.tournament, requested_by: current_user,
              base_lock_version: game.lock_version,
              reason: (attrs[:reason].strip if attrs[:reason].is_a?(String)), **values.transform_keys { |key| "proposed_#{key}" })
            Audit::Context.with(reason: request.reason) { request.save! }
          end
          render json: { correctionRequest: request.api_json }, status: :created
        rescue ActiveRecord::RecordInvalid => e
          render_errors(e.record)
        end

        def approve
          resolve("approved") do |request|
            game = Game.lock.find(request.game_id)
            if request.base_lock_version && game.lock_version != request.base_lock_version
              next Games::RecordResult::Result.new(
                status: 409,
                body: {
                  error: "This game was updated after the correction request was submitted. Review the latest score or reject this stale request.",
                  currentGame: game.api_json(include_score_audit: true)
                }
              )
            end

            reason = "Approved correction request ##{request.id}: #{request.reason}"
            Games::RecordResult.call(game, request.proposed_result.merge(reason: reason),
              actor: current_user, policy: access_policy, interactive: false, defer_recompute: true,
              require_reason_on_final_correction: false)
          end
        end

        def reject
          resolve("rejected")
        end

        private

        def allows_action?(action, tournament_id)
          access_policy.allows?("scores_and_stats", action, scope_type: "tournament", scope_id: tournament_id)
        end

        def resolve(status)
          request = ScoreCorrectionRequest.find(params[:id])
          return unless authorize_tournament!("scores_and_stats", "correct_final", request.tournament_id)

          result = nil
          note = params[:resolutionNote].to_s.strip.presence
          request.tournament.with_lock do
            request.lock!
            if request.status != "pending"
              return render json: { error: "This correction request has already been resolved." }, status: :conflict
            end
            result = yield(request) if block_given?
            return render json: result.body, status: result.status if result && !result.ok?

            Audit::Context.with(reason: note) do
              request.update!(status: status, resolved_by: current_user, resolved_at: Time.current, resolution_note: note)
            end
          end
          standings = Games::RecordResult.refresh_standings([ result&.recompute_tournament ])
          render json: { correctionRequest: request.reload.api_json }.merge(result&.body || {}, standings)
        rescue ActiveRecord::RecordInvalid => e
          render_errors(e.record)
        end
      end
    end
  end
end
