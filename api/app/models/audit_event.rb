class AuditEvent < ApplicationRecord
  before_destroy { raise ActiveRecord::ReadOnlyRecord, "Audit events are append-only" }

  def readonly?
    persisted?
  end

  def api_json
    {
      id: id.to_s,
      occurredAt: occurred_at.iso8601(6),
      operationId: operation_id,
      actorType: actor_type,
      actorId: actor_id&.to_s,
      actorName: actor_name,
      actorEmail: actor_email,
      actorRole: actor_role,
      area: area,
      action: action,
      recordType: record_type,
      recordId: record_id,
      recordLabel: record_label,
      tournamentId: tournament_id&.to_s,
      hostCampaignId: host_campaign_id&.to_s,
      summary: summary,
      before: before_json,
      after: after_json,
      metadata: metadata_json,
      legacySource: metadata_json["legacySource"],
      reason: reason,
      requestId: request_id,
      httpMethod: http_method,
      routePath: route_path
    }
  end
end
