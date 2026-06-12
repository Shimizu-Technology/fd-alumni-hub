namespace :fd do
  namespace :migration do
    desc "Import an operator-created Next/Prisma snapshot into the Rails database"
    task :import_next_snapshot, [ :path ] => :environment do |_task, args|
      path = args[:path].presence || ENV["SNAPSHOT"]
      abort "Usage: bin/rails 'fd:migration:import_next_snapshot[path/to/snapshot.json]' or SNAPSHOT=path/to/snapshot.json" if path.blank?

      result = DataMigration::NextPrismaSnapshot::Import.call(path)
      puts JSON.pretty_generate(result)
    end

    desc "Validate Rails imported records against a Next/Prisma snapshot"
    task :validate_next_snapshot, [ :path ] => :environment do |_task, args|
      path = args[:path].presence || ENV["SNAPSHOT"]
      abort "Usage: bin/rails 'fd:migration:validate_next_snapshot[path/to/snapshot.json]' or SNAPSHOT=path/to/snapshot.json" if path.blank?

      out_dir = ENV["OUT_DIR"].presence || Rails.root.join("..", "tmp", "fd-migration").to_s
      report = DataMigration::NextPrismaSnapshot::Validate.call(path, out_dir: out_dir)

      puts JSON.pretty_generate(report.slice(:ok, :counts, :scoreCoverage, :issues, :warnings))
      abort "Rails import validation failed. See #{out_dir}/rails-import-validation.md" unless report[:ok]

      puts "Rails import validation passed. Reports written to #{out_dir}"
    end
  end
end
