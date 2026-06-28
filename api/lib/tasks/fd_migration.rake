require "json"

module FdMigrationTasks
  HISTORY_SNAPSHOT_PATH = Rails.root.join("..", "data", "historical", "next-prisma-history-only.json").freeze
  HISTORY_MAX_YEAR = 2025

  module_function

  def history_snapshot_path
    HISTORY_SNAPSHOT_PATH.to_s
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
    years = tournament_years!(records.fetch("tournaments", []))
    unsafe_years = years.select { |year| year > HISTORY_MAX_YEAR }
    admin_rows = records.fetch("adminWhitelists", []).length
    user_rows = records.fetch("appUsers", []).length

    abort "Refusing to import historical snapshot with years after #{HISTORY_MAX_YEAR}: #{unsafe_years.uniq.sort.join(', ')}" if unsafe_years.any?
    abort "Refusing to import historical snapshot with admin/user rows: adminWhitelists=#{admin_rows}, appUsers=#{user_rows}" if admin_rows.positive? || user_rows.positive?
  rescue JSON::ParserError => e
    abort "Historical snapshot is not valid JSON: #{e.message}"
  rescue KeyError => e
    abort "Historical snapshot is missing required data: #{e.message}"
  end

  def tournament_years!(tournaments)
    invalid_tournaments = []

    years = tournaments.map do |tournament|
      year = tournament["year"]
      if year.is_a?(Integer)
        year
      elsif year.is_a?(String) && year.match?(/\A\d{4}\z/)
        year.to_i
      else
        invalid_tournaments << tournament_label(tournament)
        nil
      end
    end

    if invalid_tournaments.any?
      abort "Refusing to import historical snapshot with missing or invalid tournament years: #{invalid_tournaments.first(10).join(', ')}"
    end

    years
  end

  def tournament_label(tournament)
    return tournament.inspect unless tournament.is_a?(Hash)

    tournament["id"] || tournament["name"] || tournament.inspect
  end
end

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

      FdMigrationTasks.validate_snapshot!(path)
    end

    desc "Import the bundled safe historical snapshot (2005-2025) and validate it"
    task import_history: :environment do
      path = ENV["SNAPSHOT"].presence || FdMigrationTasks.history_snapshot_path
      abort "Historical snapshot not found at #{path}" unless File.exist?(path)

      FdMigrationTasks.assert_history_snapshot_safe!(path)

      puts "Importing FD Alumni historical snapshot from #{path}"
      result = DataMigration::NextPrismaSnapshot::Import.call(path)
      puts JSON.pretty_generate(result)

      FdMigrationTasks.validate_snapshot!(path)

      puts "Historical import complete."
      puts "Counts: Tournaments=#{Tournament.count} Teams=#{Team.count} Games=#{Game.count} Articles=#{ArticleLink.count} Media=#{MediaAsset.count}"
    end
  end
end
