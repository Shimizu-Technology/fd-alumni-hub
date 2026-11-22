# Defined in an initializer (non-reloaded) so PostgreSQLAdapter never retains a
# stale prepended module across development reloads, while looking up Audit::Context
# dynamically at runtime.
module AuditContextPostgresAdapterExtension
  def begin_db_transaction
    super
    ::Audit::Context.apply_to_transaction!(self)
  end

  def begin_isolated_db_transaction(isolation)
    super
    ::Audit::Context.apply_to_transaction!(self)
  end

  def exec_restart_db_transaction
    super
    ::Audit::Context.apply_to_transaction!(self)
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
    if ::Audit::Context.values.present? && !transaction_open?
      transaction(requires_new: false) { yield }
    else
      yield
    end
  end
end

ActiveSupport.on_load(:active_record_postgresqladapter) do
  prepend AuditContextPostgresAdapterExtension unless ancestors.include?(AuditContextPostgresAdapterExtension)
end
