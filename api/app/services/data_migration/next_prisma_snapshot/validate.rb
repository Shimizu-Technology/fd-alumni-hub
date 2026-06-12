require "json"
require "fileutils"
require "set"

module DataMigration
  module NextPrismaSnapshot
    class Validate
      FORMAT = "fd-alumni-hub-next-prisma-export"
      TABLES = {
        "tournaments" => Tournament,
        "teams" => Team,
        "games" => Game,
        "standings" => Standing,
        "articleLinks" => ArticleLink,
        "mediaAssets" => MediaAsset,
        "sponsors" => Sponsor,
        "contentIngestItems" => ContentIngestItem,
        "adminWhitelists" => AdminWhitelist,
        "appUsers" => User
      }.freeze

      attr_reader :path, :snapshot, :records, :issues, :warnings

      def self.call(path, out_dir: nil)
        new(path, out_dir: out_dir).call
      end

      def initialize(path, out_dir: nil)
        @path = path
        @snapshot = JSON.parse(File.read(path))
        @records = snapshot.fetch("records")
        @issues = []
        @warnings = []
        @out_dir = out_dir
      end

      def call
        validate_format!
        report = build_report
        write_report(report) if @out_dir.present?
        report
      end

      private

      def validate_format!
        return if snapshot["format"] == FORMAT && snapshot["version"].to_i == 1

        raise ArgumentError, "Unsupported snapshot format/version"
      end

      def build_report
        count_checks = TABLES.to_h do |record_key, model|
          legacy_ids = source_legacy_ids(record_key)
          imported_count = model.where(legacy_id: legacy_ids).count
          missing_ids = legacy_ids - model.where(legacy_id: legacy_ids).pluck(:legacy_id)

          issues << "#{record_key}: #{missing_ids.length} missing imported records" if missing_ids.any?

          [ record_key, { source: legacy_ids.length, imported: imported_count, missing: missing_ids.length, missingIds: missing_ids.first(25) } ]
        end

        validate_relationships
        validate_ingest_imports

        {
          path: path,
          validatedAt: Time.current.iso8601,
          sourceExportedAt: snapshot["exportedAt"],
          ok: issues.empty?,
          counts: count_checks,
          scoreCoverage: score_coverage,
          issues: issues,
          warnings: warnings
        }
      end

      def validate_relationships
        source_ids = {
          tournaments: source_legacy_ids("tournaments").to_set,
          teams: source_legacy_ids("teams").to_set
        }

        records.fetch("teams", []).each do |team|
          issues << "team #{team.fetch("id")} references missing tournament #{team["tournamentId"]}" unless source_ids[:tournaments].include?(team["tournamentId"])
        end

        records.fetch("games", []).each do |game|
          issues << "game #{game.fetch("id")} references missing tournament #{game["tournamentId"]}" unless source_ids[:tournaments].include?(game["tournamentId"])
          issues << "game #{game.fetch("id")} references missing home team #{game["homeTeamId"]}" unless source_ids[:teams].include?(game["homeTeamId"])
          issues << "game #{game.fetch("id")} references missing away team #{game["awayTeamId"]}" unless source_ids[:teams].include?(game["awayTeamId"])
        end

        records.fetch("standings", []).each do |standing|
          issues << "standing #{standing.fetch("id")} references missing tournament #{standing["tournamentId"]}" unless source_ids[:tournaments].include?(standing["tournamentId"])
          issues << "standing #{standing.fetch("id")} references missing team #{standing["teamId"]}" unless source_ids[:teams].include?(standing["teamId"])
        end
      end

      def validate_ingest_imports
        source_by_legacy_id = records.fetch("contentIngestItems", []).index_by { |item| item["id"] }

        ContentIngestItem.where(legacy_id: source_legacy_ids("contentIngestItems")).find_each do |item|
          source = source_by_legacy_id[item.legacy_id]
          if source&.dig("status") == "approved" && source["importedToId"].blank? && item.status == "pending"
            warnings << "ingest item #{item.legacy_id} was approved in source without an imported record and was reset to pending"
          end

          next unless item.status == "approved"

          if item.imported_to_id.blank?
            issues << "approved ingest item #{item.legacy_id} has no imported_to_id"
            next
          end

          imported_exists = item.kind == "article" ? ArticleLink.exists?(id: item.imported_to_id) : MediaAsset.exists?(id: item.imported_to_id)
          issues << "approved ingest item #{item.legacy_id} references missing imported #{item.kind} #{item.imported_to_id}" unless imported_exists
        end
      end

      def score_coverage
        source_games = records.fetch("games", [])
        rails_games = Game.where(legacy_id: source_games.filter_map { |game| game["id"] })

        {
          source: coverage_for_source(source_games),
          rails: coverage_for_rails(rails_games)
        }
      end

      def coverage_for_source(games)
        total = games.length
        scored = games.count { |game| !game["homeScore"].nil? && !game["awayScore"].nil? }
        final_missing_scores = games.count { |game| game["status"] == "final" && (game["homeScore"].nil? || game["awayScore"].nil?) }

        coverage_payload(total, scored, final_missing_scores)
      end

      def coverage_for_rails(scope)
        total = scope.count
        scored = scope.where.not(home_score: nil).where.not(away_score: nil).count
        final_missing_scores = scope.where(status: "final").where("home_score IS NULL OR away_score IS NULL").count

        coverage_payload(total, scored, final_missing_scores)
      end

      def coverage_payload(total, scored, final_missing_scores)
        percent = total.positive? ? ((scored.to_f / total) * 1000).round / 10.0 : 0
        { total: total, scored: scored, percent: percent, finalMissingScores: final_missing_scores }
      end

      def source_legacy_ids(record_key)
        records.fetch(record_key, []).filter_map { |record| record["id"] }
      end

      def write_report(report)
        FileUtils.mkdir_p(@out_dir)
        File.write(File.join(@out_dir, "rails-import-validation.json"), JSON.pretty_generate(report) + "\n")
        File.write(File.join(@out_dir, "rails-import-validation.md"), markdown_report(report))
      end

      def markdown_report(report)
        lines = [
          "# Rails Import Validation",
          "",
          "- Snapshot: `#{path}`",
          "- Source exported at: #{report[:sourceExportedAt]}",
          "- Validated at: #{report[:validatedAt]}",
          "- Result: #{report[:ok] ? "PASS" : "FAIL"}",
          "",
          "## Counts",
          "",
          "| Record | Source | Imported | Missing |",
          "| --- | ---: | ---: | ---: |"
        ]

        report[:counts].each do |record_key, counts|
          lines << "| #{record_key} | #{counts[:source]} | #{counts[:imported]} | #{counts[:missing]} |"
        end

        lines += [
          "",
          "## Score coverage",
          "",
          "| Scope | Total | Scored | Coverage | Final games missing scores |",
          "| --- | ---: | ---: | ---: | ---: |"
        ]

        report[:scoreCoverage].each do |scope, coverage|
          lines << "| #{scope} | #{coverage[:total]} | #{coverage[:scored]} | #{coverage[:percent]}% | #{coverage[:finalMissingScores]} |"
        end

        lines += [ "", "## Issues", "" ]
        if report[:issues].empty?
          lines << "No issues found."
        else
          report[:issues].each { |issue| lines << "- #{issue}" }
        end

        lines += [ "", "## Warnings", "" ]
        if report[:warnings].empty?
          lines << "No warnings found."
        else
          report[:warnings].each { |warning| lines << "- #{warning}" }
        end

        lines.join("\n") + "\n"
      end
    end
  end
end
