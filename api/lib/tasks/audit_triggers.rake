%w[db:schema:load db:prepare db:migrate].each do |task|
  Rake::Task[task].enhance { Audit::DatabaseTriggers.install! }
end

if Rake::Task.task_defined?("db:test:prepare")
  Rake::Task["db:test:prepare"].enhance do
    ActiveRecord::Tasks::DatabaseTasks.with_temporary_pool_for_each(env: "test") do |pool|
      pool.with_connection { |conn| Audit::DatabaseTriggers.install!(conn) }
    end
  end
end

namespace :audit do
  desc "Backfill the audit history from the existing finance ledger"
  task backfill_finance: :environment do
    Audit::LegacyFinanceSync.backfill!
  end
end
