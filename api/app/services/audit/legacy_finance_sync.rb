module Audit
  module LegacyFinanceSync
    SOURCE = "finance_audit_events"
    ACTION_LABELS = {
      "archive_campaign" => "archived the campaign",
      "approve_reimbursement" => "approved a reimbursement",
      "mark_reimbursed" => "marked a reimbursement as paid",
      "attach_receipt" => "attached a receipt",
      "view_receipt" => "viewed a receipt",
      "accept_invitation" => "accepted a campaign invitation",
      "settings_change" => "updated campaign settings"
    }.freeze

    def self.sync_event!(event)
      actor = event.actor
      campaign = event.host_campaign
      context = Context.values || {}
      snapshot = Context.actor_values(actor)
      if context[:actor_id] == actor&.id && actor
        snapshot[:actor_role] = context[:actor_role]
      end
      snapshot[:actor_id] = event.actor_id
      snapshot[:actor_name] ||= "Unavailable"
      label = "#{event.record_type.underscore.humanize} ##{event.record_id}"
      changes = redact(event.changes_json)
      provenance = { legacySource: SOURCE, changes: changes }
      AuditEvent.insert_all([ snapshot.merge(
        occurred_at: event.created_at,
        operation_id: context[:operation_id] || SecureRandom.uuid,
        area: "finance",
        action: event.action,
        record_type: event.record_type,
        record_id: event.record_id.to_s,
        record_label: label,
        tournament_id: campaign&.tournament_id,
        host_campaign_id: event.host_campaign_id,
        summary: "#{snapshot[:actor_name]} #{action_description(event.action, label)}",
        after_json: provenance,
        metadata_json: provenance,
        reason: redact(event.reason || context[:reason]),
        request_id: context[:request_id],
        http_method: context[:http_method],
        route_path: redact(context[:route_path]),
        ip_address: event.ip_address || context[:ip_address],
        legacy_finance_audit_event_id: event.id
      ) ], unique_by: :legacy_finance_audit_event_id)
    end

    def self.backfill!
      FinanceAuditEvent.includes(:actor, :host_campaign).find_each { |event| sync_event!(event) }
    end

    def self.action_description(action, label)
      return "#{ACTION_LABELS.fetch(action)} (#{label})" if ACTION_LABELS.key?(action)

      verb, subject = action.split("_", 2)
      past = { "create" => "created", "update" => "updated", "delete" => "deleted", "archive" => "archived",
               "void" => "voided", "attach" => "attached", "remove" => "removed" }[verb]
      past ? "#{past} #{subject&.tr('_', ' ') || label}" : "recorded #{action.tr('_', ' ')} for #{label}"
    end
    private_class_method :action_description

    def self.redact(value)
      AuditEvent.with_connection do |conn|
        JSON.parse(conn.select_value("SELECT fd_audit_redact(#{conn.quote(value.to_json)}::jsonb)::text"))
      end
    end
    private_class_method :redact
  end
end
