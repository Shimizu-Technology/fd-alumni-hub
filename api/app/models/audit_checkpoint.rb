class AuditCheckpoint < ApplicationRecord
  before_destroy { raise ActiveRecord::ReadOnlyRecord, "Audit checkpoints are append-only" }

  def readonly?
    persisted?
  end

  def api_json
    {
      id: id.to_s,
      createdAt: created_at.iso8601(6),
      firstAuditEventId: first_audit_event_id.to_s,
      lastAuditEventId: last_audit_event_id.to_s,
      eventCount: event_count,
      previousDigest: previous_digest,
      chainDigest: chain_digest,
      hmacSignature: hmac_signature
    }
  end
end
