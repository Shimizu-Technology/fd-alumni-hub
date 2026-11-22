require "json"

module DataImport
  class FdChampionHistoryImport
    DEFAULT_PATH = Rails.root.join("..", "data", "historical", "fd-alumni-champions.json")

    def self.call(path: DEFAULT_PATH)
      new(path).call
    end

    def self.lock_archive!
      TournamentChampion.connection.execute("SELECT pg_advisory_xact_lock(214923, 9)")
    end

    def initialize(path)
      @path = Pathname(path)
    end

    def call
      Audit::Context.with { perform }
    end

    private def perform
      records = JSON.parse(path.read)
      imported = 0

      TournamentChampion.transaction do
        self.class.lock_archive!
        records.each_with_index do |source, index|
          champion = champion_for(source)
          champion.assign_attributes(attributes_for(source, index))
          champion.save!
          imported += 1
        end
      end

      class_archive = ClassArchive::Backfill.call

      {
        path: path.to_s,
        imported: imported,
        total: TournamentChampion.count,
        classArchive: class_archive,
        titleCounts: TournamentChampion.title_counts.map { |entry| entry.slice(:championLabel, :titles, :years) }
      }
    end

    private

    attr_reader :path

    def champion_for(source)
      slug = slug_for(source)
      existing = TournamentChampion.find_by(slug: slug)
      return existing if existing

      if source["bracket"] == "maroon" && source["primary"] && source["editionLabel"].blank?
        legacy = TournamentChampion.primary_titles.find_by(slug: source.fetch("year").to_s, year: source.fetch("year"), bracket: "overall")
        return legacy if legacy
      end

      TournamentChampion.new(slug: slug)
    end

    def attributes_for(source, index)
      year = Integer(source.fetch("year"))
      champion_label = source["champion"].to_s.strip
      runner_up_label = source["runnerUp"].to_s.strip.presence

      {
        tournament: tournament_for(year),
        year: year,
        edition_label: source["editionLabel"].to_s.strip,
        slug: slug_for(source),
        champion_label: champion_label,
        champion_key: TournamentChampion.canonical_key(source["championKey"].presence || champion_label),
        runner_up_label: runner_up_label,
        runner_up_key: TournamentChampion.canonical_key(source["runnerUpKey"].presence || runner_up_label),
        score: source["score"].to_s.strip.presence,
        mvp_name: source["mvpName"],
        mvp_note: source["mvpNote"],
        source_url: source["sourceUrl"],
        bracket: source["bracket"].presence || "overall",
        primary: source.key?("primary") ? source["primary"] : true,
        status: source["status"].presence || "completed",
        source: source["source"].to_s.strip,
        notes: source["notes"].to_s.strip.presence,
        position: index + 1
      }
    end

    def slug_for(source)
      return source["slug"].to_s.strip.parameterize if source["slug"].present?

      bracket = source["bracket"].to_s.strip.downcase
      bracket_slug = bracket.present? && !%w[overall unknown].include?(bracket) ? bracket : nil
      [ source.fetch("year"), source["editionLabel"].presence, bracket_slug ].compact.join("-").parameterize
    end

    def tournament_for(year)
      Tournament.where(year: year).order(:start_date, :id).first
    end
  end
end
