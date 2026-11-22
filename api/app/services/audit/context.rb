module Audit
  class Context < ActiveSupport::CurrentAttributes
    attribute :connection, :values

    KEYS = %i[
      operation_id actor_type actor_id actor_name actor_email actor_role
      reason request_id http_method route_path ip_address action_override
    ].freeze

    def self.with(actor: nil, request_id: nil, http_method: nil, route_path: nil, ip_address: nil,
                  operation_id: nil, reason: nil, action_override: nil)
      ActiveRecord::Base.with_connection do |conn|
        context = {
          request_id: request_id, http_method: http_method, route_path: route_path,
          ip_address: ip_address, reason: reason, action_override: action_override
        }.compact
        context[:operation_id] = operation_id || values&.fetch(:operation_id) || SecureRandom.uuid
        context = (values || {}).merge(context)
        context.merge!(actor_values(actor, actor_type: request_id ? "anonymous" : "system")) if actor || values.nil?

        if conn.transaction_open?
          # The savepoint also restores local settings on a database error,
          # when PostgreSQL rejects all statements until rollback.
          conn.transaction(requires_new: true, joinable: conn.current_transaction.joinable?) do
            with_settings(conn, context) { yield }
          end
        else
          with_settings(conn, context) { yield }
        end
      end
    end

    def self.set_actor!(actor, roles: [])
      return unless connection && actor

      snapshot = actor_values(actor, roles: roles)
      apply(connection, snapshot, connection.transaction_open?)
      values.merge!(snapshot)
    end

    def self.actor_values(actor, roles: [], actor_type: "system")
      {
        actor_type: actor ? "user" : actor_type,
        actor_id: actor&.id,
        actor_name: actor&.full_name,
        actor_email: actor&.email,
        actor_role: actor && [ actor.role, *roles.sort ].uniq.join(", ")
      }
    end

    def self.with_settings(conn, context)
      local = conn.transaction_open?
      prior = conn.select_one("SELECT " + KEYS.map { |key| "current_setting('app.audit_#{key}', true) AS #{key}" }.join(", "))
      apply(conn, KEYS.index_with { |key| context[key] }, local)
      set(connection: conn, values: context) { yield }
    ensure
      # An exception in a local scope rolls back its savepoint and settings.
      apply(conn, prior, local) if prior && (!local || !$!)
    end
    private_class_method :with_settings

    def self.apply(conn, attributes, local)
      return if attributes.empty?

      conn.execute("SELECT " + attributes.map do |key, value|
        "set_config('app.audit_#{key}', #{conn.quote(value.to_s)}, #{local})"
      end.join(", "))
    end
    private_class_method :apply
  end
end
