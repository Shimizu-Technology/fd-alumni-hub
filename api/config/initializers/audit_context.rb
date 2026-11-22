ActiveSupport.on_load(:active_record_postgresqladapter) do
  prepend Audit::Context::PostgresAdapterExtension unless ancestors.include?(Audit::Context::PostgresAdapterExtension)
end
