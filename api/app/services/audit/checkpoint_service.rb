require "digest"
require "openssl"

module Audit
  class CheckpointService
    # Explicit v1 column list so future additive migrations on audit_events
    # never invalidate historical checkpoint digests.
    CANONICAL_EVENT_SQL = <<~SQL.squish.freeze
      jsonb_build_object(
        'id', id,
        'occurred_at', occurred_at,
        'operation_id', operation_id,
        'actor_type', actor_type,
        'actor_id', actor_id,
        'actor_name', actor_name,
        'actor_email', actor_email,
        'actor_role', actor_role,
        'area', area,
        'action', action,
        'record_type', record_type,
        'record_id', record_id,
        'record_label', record_label,
        'tournament_id', tournament_id,
        'host_campaign_id', host_campaign_id,
        'summary', summary,
        'before_json', before_json,
        'after_json', after_json,
        'metadata_json', metadata_json,
        'reason', reason,
        'request_id', request_id,
        'http_method', http_method,
        'route_path', route_path,
        'ip_address', ip_address,
        'legacy_finance_audit_event_id', legacy_finance_audit_event_id
      )::text
    SQL

    class << self
      def create!
        # Briefly drain in-flight audit inserts to fix a safe upper bound without
        # holding LOCK TABLE audit_events while hashing in Ruby.
        upper_bound = capture_upper_bound!
        previous = latest
        return previous if upper_bound.nil? || (previous && upper_bound <= previous.last_audit_event_id)

        range = range_digest(previous&.last_audit_event_id, previous&.chain_digest, through: upper_bound)
        return previous if range[:event_count].zero?

        AuditCheckpoint.transaction do
          connection = AuditCheckpoint.connection
          connection.execute("SET LOCAL lock_timeout = '5s'")
          connection.execute("LOCK TABLE audit_checkpoints IN SHARE ROW EXCLUSIVE MODE")

          current_previous = latest
          if current_previous&.id != previous&.id
            previous = current_previous
            next previous if previous && upper_bound <= previous.last_audit_event_id

            range = range_digest(previous&.last_audit_event_id, previous&.chain_digest, through: upper_bound)
            next previous if range[:event_count].zero?
          end

          AuditCheckpoint.create!(range.merge(
            previous_digest: previous&.chain_digest,
            hmac_signature: signature(range[:chain_digest], signing_key)
          ))
        end
      end

      def verify!
        errors = []
        warnings = []
        previous = nil
        checked_count = 0
        unsigned_checkpoints = 0
        key = signing_key

        AuditCheckpoint.find_each do |checkpoint|
          range = range_digest(previous&.last_audit_event_id, previous&.chain_digest, through: checkpoint.last_audit_event_id)
          errors.concat(checkpoint_errors(checkpoint, range, previous, key))
          unsigned_checkpoints += 1 if checkpoint.hmac_signature.blank?
          previous = checkpoint
          checked_count += 1
        end

        if key.blank?
          warnings << "AUDIT_CHECKPOINT_SIGNING_KEY is not set; checkpoints are hash-chained only and not HMAC-signed."
        elsif unsigned_checkpoints.positive?
          warnings << "#{unsigned_checkpoints} checkpoint(s) are unsigned."
        end

        {
          valid: errors.empty?,
          signed: key.present? && checked_count.positive? && unsigned_checkpoints.zero?,
          checked_count: checked_count,
          unsigned_checkpoints: unsigned_checkpoints,
          latest_checkpoint_id: previous&.id,
          uncheckpointed_events: after(previous).count,
          warnings: warnings,
          errors: errors
        }
      end

      def latest
        AuditCheckpoint.order(id: :desc).first
      end

      def summary(checkpoint = latest)
        {
          latestCheckpointId: checkpoint&.id&.to_s,
          createdAt: checkpoint&.created_at&.iso8601(6),
          coveredEventCount: checkpoint ? AuditCheckpoint.where(id: ..checkpoint.id).sum(:event_count) : 0,
          uncheckpointedEventCount: after(checkpoint).count
        }
      end

      private

      def capture_upper_bound!
        AuditCheckpoint.transaction do
          connection = AuditCheckpoint.connection
          connection.execute("SET LOCAL lock_timeout = '5s'")
          connection.execute("LOCK TABLE audit_events IN SHARE MODE")
          AuditEvent.maximum(:id)
        end
      end

      def after(checkpoint)
        AuditEvent.where("id > ?", checkpoint&.last_audit_event_id || 0)
      end

      def range_digest(last_id, previous_digest, through: nil)
        scope = AuditEvent.where("id > ?", last_id || 0)
        scope = scope.where(id: ..through) if through
        digest = Digest::SHA256.new << "fd-audit-checkpoint-v1\n#{previous_digest}\n"
        first = last = nil
        count = 0

        # PostgreSQL JSONB supplies a deterministic field order and preserves the
        # numeric precision of the stored snapshots across the explicit v1 columns.
        scope.in_batches(of: 1000) do |batch|
          batch.order(:id).pluck(:id, Arel.sql(CANONICAL_EVENT_SQL)).each do |id, json|
            first ||= id
            last = id
            count += 1
            digest << "#{json.bytesize}:" << json
          end
        end

        { first_audit_event_id: first, last_audit_event_id: last, event_count: count, chain_digest: digest.hexdigest }
      end

      def checkpoint_errors(checkpoint, range, previous, key)
        errors = []
        errors << "range or count mismatch" unless range.except(:chain_digest).all? { |field, value| checkpoint[field] == value }
        errors << "previous digest mismatch" unless checkpoint.previous_digest == previous&.chain_digest
        errors << "chain digest mismatch" unless checkpoint.chain_digest == range[:chain_digest]
        if key && !ActiveSupport::SecurityUtils.secure_compare(checkpoint.hmac_signature.to_s, signature(range[:chain_digest], key))
          errors << "HMAC signature mismatch"
        end
        errors.map { |error| "Checkpoint #{checkpoint.id}: #{error}" }
      end

      def signing_key
        ENV["AUDIT_CHECKPOINT_SIGNING_KEY"].presence
      end

      def signature(digest, key)
        OpenSSL::HMAC.hexdigest("SHA256", key, digest) if key
      end
    end
  end
end
