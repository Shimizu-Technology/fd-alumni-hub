module Audit
  class Context < ActiveSupport::CurrentAttributes
    attribute :values

    KEYS = %i[
      operation_id actor_type actor_id actor_name actor_email actor_role
      reason request_id http_method route_path ip_address action_override
    ].freeze

    module PostgresAdapterExtension
      def begin_db_transaction
        super
        Audit::Context.apply_to_transaction!(self)
      end

      def begin_isolated_db_transaction(isolation)
        super
        Audit::Context.apply_to_transaction!(self)
      end

      def exec_restart_db_transaction
        super
        Audit::Context.apply_to_transaction!(self)
      end

      def exec_insert(*args, **kwargs)
        with_audit_transaction { super }
      end

      def exec_insert_all(*args, **kwargs)
        with_audit_transaction { super }
      end

      def exec_update(*args, **kwargs)
        with_audit_transaction { super }
      end

      def exec_delete(*args, **kwargs)
        with_audit_transaction { super }
      end

      private

      def with_audit_transaction
        if Audit::Context.values.present? && !transaction_open?
          transaction(requires_new: false) { yield }
        else
          yield
        end
      end
    end

    def self.with(actor: nil, actor_type: nil, request_id: nil, http_method: nil, route_path: nil,
                  ip_address: nil, operation_id: nil, reason: nil, action_override: nil)
      context = {
        request_id: request_id, http_method: http_method, route_path: route_path,
        ip_address: ip_address, reason: reason, action_override: action_override
      }.compact
      context[:operation_id] = operation_id || values&.fetch(:operation_id, nil) || SecureRandom.uuid
      context = (values || {}).merge(context)
      if actor || actor_type || values.nil?
        default_type = actor_type || (request_id ? "anonymous" : "system")
        context.merge!(actor_values(actor, actor_type: default_type))
      end

      conn = active_transaction_connection
      if conn
        # Savepoint isolates transaction-local settings inside an already-open transaction
        # (including transactional tests and nested Audit::Context.with blocks).
        conn.transaction(requires_new: true, joinable: conn.current_transaction.joinable?) do
          with_local_settings(conn, context) { yield }
        end
      else
        set(values: context) { yield }
      end
    end

    def self.set_actor!(actor, roles: [])
      return unless values && actor

      snapshot = actor_values(actor, roles: roles)
      values.merge!(snapshot)

      conn = active_transaction_connection
      apply_local!(conn, snapshot) if conn&.current_transaction&.materialized?
    end

    def self.apply_to_transaction!(conn)
      return if values.blank?

      apply_local!(conn, KEYS.index_with { |key| values[key] }, materialize_transactions: false)
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

    def self.active_transaction_connection
      conn = ActiveRecord::Base.connection_pool.active_connection
      conn if conn&.transaction_open?
    end
    private_class_method :active_transaction_connection

    def self.with_local_settings(conn, context)
      prior = conn.select_one(
        "SELECT " + KEYS.map { |key| "current_setting('app.audit_#{key}', true) AS #{key}" }.join(", ")
      )
      apply_local!(conn, KEYS.index_with { |key| context[key] })
      failed = false
      begin
        set(values: context) { yield }
      rescue Exception
        failed = true
        raise
      ensure
        # On exception, PostgreSQL rolls back the savepoint and discards its SET LOCAL values.
        apply_local!(conn, prior) if prior && !failed
      end
    end
    private_class_method :with_local_settings

    def self.apply_local!(conn, attributes, materialize_transactions: true)
      return if attributes.empty?

      sql = "SELECT " + attributes.map do |key, value|
        "set_config('app.audit_#{key}', #{conn.quote(value.to_s)}, true)"
      end.join(", ")

      if materialize_transactions
        conn.execute(sql)
      else
        conn.send(:internal_execute, sql, "AUDIT", allow_retry: false, materialize_transactions: false)
      end
    end
    private_class_method :apply_local!
  end
end
