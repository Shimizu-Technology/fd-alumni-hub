module Audit
  class EventRecorder
    def self.record!(area:, action:, summary:, record: nil, record_type: nil, record_id: nil,
                     tournament_id: nil, host_campaign_id: nil, metadata: {})
      Context.with do
        context = Context.values.except(:action_override)
        campaign = record if record.is_a?(HostCampaign)
        resolved_type = record_type || record&.class&.name || "System"
        resolved_id = (record_id || record&.id || "system").to_s
        resolved_campaign_id = host_campaign_id || campaign&.id
        resolved_tournament_id = tournament_id || (campaign ? campaign.tournament_id : (record.is_a?(Tournament) ? record.id : nil))

        AuditEvent.create!(context.merge(
          area: area, action: action, record_type: resolved_type, record_id: resolved_id,
          summary: summary, host_campaign_id: resolved_campaign_id,
          tournament_id: resolved_tournament_id,
          metadata_json: Redactor.call(metadata),
          reason: Redactor.call(context[:reason]),
          route_path: Redactor.call(context[:route_path])
        ))
      end
    end
  end
end
