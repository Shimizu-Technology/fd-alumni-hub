module Audit
  class EventRecorder
    def self.record!(area:, action:, record:, summary:, metadata: {})
      Context.with do
        context = Context.values.except(:action_override)
        campaign = record if record.is_a?(HostCampaign)

        AuditEvent.create!(context.merge(
          area: area, action: action, record_type: record.class.name, record_id: record.id.to_s,
          summary: summary, host_campaign_id: campaign&.id,
          tournament_id: campaign ? campaign.tournament_id : record.id,
          metadata_json: Redactor.call(metadata),
          reason: Redactor.call(context[:reason]),
          route_path: Redactor.call(context[:route_path])
        ))
      end
    end
  end
end
