module Audit
  class Redactor
    def self.call(value)
      AuditEvent.with_connection do |connection|
        json = connection.quote(value.to_json)
        JSON.parse(connection.select_value("SELECT fd_audit_redact(#{json}::jsonb)::text"))
      end
    end
  end
end
