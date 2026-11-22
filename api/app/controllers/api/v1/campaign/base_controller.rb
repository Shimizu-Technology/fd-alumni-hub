module Api
  module V1
    module Campaign
      class BaseController < Api::V1::BaseController
        wrap_parameters false

        before_action :set_no_store_headers
        before_action :authenticate_user!
        before_action :load_campaign

        private

        def set_no_store_headers
          response.headers["Cache-Control"] = "no-store"
        end

        def load_campaign
          @campaign = HostCampaign.find_by!(slug: params[:campaign_slug].to_s.strip.downcase)
          Audit::Context.set_actor!(current_user, roles: current_campaign_roles) unless request.get? || request.head?
        end

        def current_campaign_roles
          @current_campaign_roles ||= current_user.campaign_roles_for(@campaign)
        end

        def campaign_role?(*allowed_roles)
          return true if current_user&.admin?

          allowed = allowed_roles.map(&:to_s)
          (current_campaign_roles & allowed).any?
        end

        def require_campaign_access!(capability, action, *legacy_roles)
          policy = Access::Policy.new(current_user)
          return if policy.explicitly_allows?(capability, action, scope_type: "campaign", scope_id: @campaign.id)
          # Preserve existing per-action membership permissions while that duty is managed through memberships.
          explicit = current_user.permission_grants.where(scope_type: "campaign", scope_id: @campaign.id, capability: capability)
          return if !explicit.exists? && campaign_role?(*legacy_roles)

          render_forbidden("Campaign access required.")
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

        def extract_object_params(*wrapper_keys)
          wrapper_keys.each do |key|
            next unless params.key?(key)

            candidate = params[key]
            return candidate if candidate.is_a?(ActionController::Parameters)

            render json: { error: "Invalid #{key} payload format." }, status: :unprocessable_entity
            return nil
          end

          params
        end

        def parse_strict_iso_date(raw_value, field_label:)
          return [ true, nil ] if raw_value.nil? || (raw_value.is_a?(String) && raw_value.strip.empty?)
          return [ true, raw_value ] if raw_value.is_a?(Date)
          unless raw_value.is_a?(String)
            return [ false, "#{field_label} must be an ISO date (YYYY-MM-DD)" ]
          end

          trimmed = raw_value.strip
          unless trimmed.match?(/\A\d{4}-\d{2}-\d{2}\z/)
            return [ false, "#{field_label} must be an ISO date (YYYY-MM-DD)" ]
          end

          [ true, Date.iso8601(trimmed) ]
        rescue Date::Error, ArgumentError
          [ false, "#{field_label} is not a valid calendar date" ]
        end
      end
    end
  end
end
