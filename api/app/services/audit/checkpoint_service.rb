require "digest"
require "openssl"

module Audit
  class CheckpointService
    class << self
      def create!
        AuditCheckpoint.transaction do
          connection = AuditCheckpoint.connection
          # Drain in-flight inserts before choosing the upper bound. Sequence IDs
          # can be allocated in a different order from transaction commits.
          connection.execute("LOCK TABLE audit_events IN SHARE MODE")
          connection.execute("LOCK TABLE audit_checkpoints IN SHARE ROW EXCLUSIVE MODE")

          previous = latest
          range = range_digest(previous&.last_audit_event_id, previous&.chain_digest)
          next previous if range[:event_count].zero?

          AuditCheckpoint.create!(range.merge(
            previous_digest: previous&.chain_digest,
            hmac_signature: signature(range[:chain_digest], signing_key)
          ))
        end
      end

      def verify!
        errors = []
        previous = nil
        checked_count = 0
        key = signing_key

        AuditCheckpoint.find_each do |checkpoint|
          range = range_digest(previous&.last_audit_event_id, previous&.chain_digest, through: checkpoint.last_audit_event_id)
          errors.concat(checkpoint_errors(checkpoint, range, previous, key))
          previous = checkpoint
          checked_count += 1
        end

        {
          valid: errors.empty?, checked_count: checked_count, latest_checkpoint_id: previous&.id,
          uncheckpointed_events: after(previous).count, errors: errors
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
        # numeric precision of the stored snapshots. Hash every ledger column.
        scope.in_batches(of: 1000) do |batch|
          batch.order(:id).pluck(:id, Arel.sql("to_jsonb(audit_events)::text")).each do |id, json|
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
