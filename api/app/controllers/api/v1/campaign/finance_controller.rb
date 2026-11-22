module Api
  module V1
    module Campaign
      class FinanceController < BaseController
        before_action -> { require_campaign_role!("board", "chair", "treasurer") }

        def summary
          render json: {
            campaign: @campaign.admin_json,
            roles: current_user.admin? ? %w[admin] : current_campaign_roles,
            summary: HostCampaigns::FinanceSummary.call(@campaign)
          }
        end

        def audit_events
          requested = Integer(params[:limit].to_s, 10, exception: false)
          limit = (requested && requested.positive?) ? [ requested, 200 ].min : 100

          events = @campaign.finance_audit_events
            .includes(:actor)
            .order(created_at: :desc, id: :desc)
            .limit(limit)

          render json: {
            auditEvents: events.map { |ev| serialize_audit_event(ev) }
          }
        end

        private

        def serialize_audit_event(ev)
          {
            id: ev.id.to_s,
            hostCampaignId: ev.host_campaign_id.to_s,
            actorId: ev.actor_id.to_s,
            actorName: ev.actor&.full_name,
            actorEmail: ev.actor&.email,
            recordType: ev.record_type,
            recordId: ev.record_id.to_s,
            action: ev.action,
            changes: ev.changes_json,
            reason: ev.reason,
            createdAt: ev.created_at&.iso8601
          }
        end
      end
    end
  end
end
