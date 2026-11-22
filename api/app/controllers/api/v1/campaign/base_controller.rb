module Api
  module V1
    module Campaign
      class BaseController < Api::V1::BaseController
        before_action :set_no_store_headers
        before_action :authenticate_user!
        before_action :load_campaign

        private

        def set_no_store_headers
          response.headers["Cache-Control"] = "no-store"
        end

        def load_campaign
          @campaign = HostCampaign.find_by!(slug: params[:campaign_slug].to_s.strip.downcase)
        end

        def current_campaign_roles
          @current_campaign_roles ||= current_user.campaign_roles_for(@campaign)
        end

        def campaign_role?(*allowed_roles)
          return true if current_user&.admin?

          allowed = allowed_roles.map(&:to_s)
          (current_campaign_roles & allowed).any?
        end

        def require_campaign_role!(*allowed_roles)
          return if campaign_role?(*allowed_roles)

          render_forbidden("Campaign role required: #{allowed_roles.join(', ')}")
        end

        def require_campaign_writable!
          return unless @campaign.archived?

          if current_user&.admin? && break_glass_reason.present?
            return
          end

          message = if current_user&.admin?
            "Archived campaign is read-only; supply breakGlassReason for an audited admin override."
          else
            "Archived campaign is read-only."
          end

          render json: { error: message }, status: :unprocessable_entity
        end

        def break_glass_reason
          params[:breakGlassReason].presence ||
            params[:break_glass_reason].presence ||
            params.dig(:campaign, :breakGlassReason).presence ||
            params.dig(:campaign, :break_glass_reason).presence
        end

        def record_audit!(record:, action:, changes: {}, reason: nil)
          FinanceAuditEvent.record!(
            campaign: @campaign,
            actor: current_user,
            record: record,
            action: action,
            changes: changes,
            reason: reason.presence || break_glass_reason,
            ip_address: request.remote_ip
          )
        end

        def render_errors(record)
          render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
        end

        def assign_param(attrs, permitted, target_key, *source_keys)
          source_keys.each do |source_key|
            next unless permitted.key?(source_key)

            attrs[target_key] = permitted[source_key]
            return
          end
        end
      end
    end
  end
end
