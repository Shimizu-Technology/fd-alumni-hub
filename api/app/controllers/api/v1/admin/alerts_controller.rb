module Api
  module V1
    module Admin
      class AlertsController < BaseController
        def index
          ids = access_policy.scope_ids("tournament", capability: "tonights_menu_and_news", action: "view")
          site_access = access_policy.allows?("tonights_menu_and_news", "view")
          return render_forbidden unless site_access || ids.any?
          return render_forbidden if !site_access && params[:tournamentId].present? && !ids.include?(params[:tournamentId].to_i)

          alerts = TournamentAlert.ordered_for_display
          alerts = alerts.where(tournament_id: ids) unless site_access
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
          return unless authorize_alert_write!(alert.tournament_id)
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
          return unless authorize_alert_write!(alert.tournament_id)
          target = alert_params
          return if target.key?(:tournament_id) && !authorize_alert_write!(target[:tournament_id])

          alert.assign_attributes(alert_params)
          alert.updated_by = current_user

          if alert.save
            render_record(alert, key: :alert)
          else
            render_errors(alert)
          end
        end

        def destroy
          alert = TournamentAlert.find(params[:id])
          return unless authorize_alert_write!(alert.tournament_id)

          alert.destroy!
          head :no_content
        end

        private

        def authorize_alert_write!(id)
          return authorize!("tonights_menu_and_news", "alert_site_wide") unless id

          authorize_tournament!("tonights_menu_and_news", "publish", id)
        end

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
