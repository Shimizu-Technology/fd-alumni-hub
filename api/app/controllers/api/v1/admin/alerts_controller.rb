module Api
  module V1
    module Admin
      class AlertsController < BaseController
        def index
          alerts = TournamentAlert.ordered_for_display
          if params[:tournamentId].present?
            tid = Integer(params[:tournamentId].to_s.strip, 10, exception: false)
            return render json: { errors: [ "tournamentId must be a valid integer" ] }, status: :unprocessable_entity unless tid&.positive?

            if params[:scope] == "tournament_only"
              alerts = alerts.where(tournament_id: tid)
            else
              alerts = alerts.where(tournament_id: [ nil, tid ])
            end
          end

          render json: { alerts: alerts.limit(100).map(&:api_json) }
        end

        def create
          alert = TournamentAlert.new(alert_params)
          alert.created_by = current_user
          alert.updated_by = current_user

          if alert.save
            render_record(alert, key: :alert, status: :created)
          else
            render_errors(alert)
          end
        end

        def update
          alert = TournamentAlert.find(params[:id])
          alert.assign_attributes(alert_params)
          alert.updated_by = current_user

          if alert.save
            render_record(alert, key: :alert)
          else
            render_errors(alert)
          end
        end

        def destroy
          TournamentAlert.find(params[:id]).destroy!
          head :no_content
        end

        private

        def alert_params
          raw = params.fetch(:alert, params)
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :severity,
            :title,
            :message,
            :active,
            :starts_at,
            :startsAt,
            :expires_at,
            :expiresAt
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          attrs[:tournament_id] = nil if attrs.key?(:tournament_id) && attrs[:tournament_id].blank?
          assign_param(attrs, permitted, :severity, :severity)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :message, :message)
          assign_param(attrs, permitted, :active, :active)
          assign_param(attrs, permitted, :starts_at, :starts_at, :startsAt)
          assign_param(attrs, permitted, :expires_at, :expires_at, :expiresAt)
          attrs
        end
      end
    end
  end
end
