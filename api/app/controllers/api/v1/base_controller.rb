module Api
  module V1
    class BaseController < ApplicationController
      include ClerkAuthenticatable

      around_action :with_audit_context, if: :audit_request?

      private

      def audit_request?
        request.headers["Authorization"].present? || !(request.get? || request.head?)
      end

      def with_audit_context(&action)
        Audit::Context.with(
          request_id: request.request_id,
          http_method: request.request_method,
          route_path: request.path,
          ip_address: request.remote_ip,
          reason: audit_reason(params),
          &action
        )
      end

      def audit_reason(payload)
        keys = %i[reason forceReason force_reason overrideReason override_reason breakGlassReason break_glass_reason]
        keys.each do |key|
          value = payload[key]
          return value.strip if value.is_a?(String) && value.present?
        end

        payload.each_value do |value|
          next unless value.is_a?(ActionController::Parameters)

          reason = audit_reason(value)
          return reason if reason
        end
        nil
      end
    end
  end
end
