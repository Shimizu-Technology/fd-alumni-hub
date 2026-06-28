namespace :fd do
  namespace :migration do
    HISTORY_SNAPSHOT_PATH = Rails.root.join("..", "data", "historical", "next-prisma-history-only.json")
    HISTORY_MAX_YEAR = 2025

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

      validate_snapshot!(path)
    end

    desc "Import the bundled safe historical snapshot (2005-2025) and validate it"
    task import_history: :environment do
      path = ENV["SNAPSHOT"].presence || HISTORY_SNAPSHOT_PATH.to_s
      abort "Historical snapshot not found at #{path}" unless File.exist?(path)

      assert_history_snapshot_safe!(path)

      puts "Importing FD Alumni historical snapshot from #{path}"
      result = DataMigration::NextPrismaSnapshot::Import.call(path)
      puts JSON.pretty_generate(result)

      validate_snapshot!(path)

      puts "Historical import complete."
      puts "Counts: Tournaments=#{Tournament.count} Teams=#{Team.count} Games=#{Game.count} Articles=#{ArticleLink.count} Media=#{MediaAsset.count}"
    end

    def validate_snapshot!(path)
      out_dir = ENV["OUT_DIR"].presence || Rails.root.join("..", "tmp", "fd-migration").to_s
      report = DataMigration::NextPrismaSnapshot::Validate.call(path, out_dir: out_dir)

      puts JSON.pretty_generate(report.slice(:ok, :counts, :scoreCoverage, :issues, :warnings))
      abort "Rails import validation failed. See #{out_dir}/rails-import-validation.md" unless report[:ok]

      puts "Rails import validation passed. Reports written to #{out_dir}"
    end

    def assert_history_snapshot_safe!(path)
      snapshot = JSON.parse(File.read(path))
      records = snapshot.fetch("records")
      years = records.fetch("tournaments", []).filter_map { |tournament| tournament["year"].to_i }
      unsafe_years = years.select { |year| year > HISTORY_MAX_YEAR }
      admin_rows = records.fetch("adminWhitelists", []).length
      user_rows = records.fetch("appUsers", []).length

      abort "Refusing to import historical snapshot with years after #{HISTORY_MAX_YEAR}: #{unsafe_years.uniq.sort.join(', ')}" if unsafe_years.any?
      abort "Refusing to import historical snapshot with admin/user rows: adminWhitelists=#{admin_rows}, appUsers=#{user_rows}" if admin_rows.positive? || user_rows.positive?
    rescue JSON::ParserError => e
      abort "Historical snapshot is not valid JSON: #{e.message}"
    end
  end
end
