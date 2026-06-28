require "json"

module DataImport
  class FdChampionHistoryImport
    DEFAULT_PATH = Rails.root.join("..", "data", "historical", "fd-alumni-champions.json")

    def self.call(path: DEFAULT_PATH)
      new(path).call
    end

    def initialize(path)
      @path = Pathname(path)
    end

    def call
      records = JSON.parse(path.read)
      imported = 0

      TournamentChampion.transaction do
        records.each_with_index do |source, index|
          champion = TournamentChampion.find_or_initialize_by(slug: slug_for(source))
          champion.assign_attributes(attributes_for(source, index))
          champion.save!
          imported += 1
        end
      end

      {
        path: path.to_s,
        imported: imported,
        total: TournamentChampion.count,
        titleCounts: TournamentChampion.title_counts.map { |entry| entry.slice(:championLabel, :titles, :years) }
      }
    end

    private

    attr_reader :path

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
        bracket: source["bracket"].presence || "overall",
        primary: source.key?("primary") ? source["primary"] : true,
        status: source["status"].presence || "completed",
        source: source["source"].to_s.strip,
        notes: source["notes"].to_s.strip.presence,
        position: index + 1
      }
    end

    def slug_for(source)
      [ source.fetch("year"), source["editionLabel"].presence ].compact.join("-").parameterize
    end

    def tournament_for(year)
      Tournament.where(year: year).order(:start_date, :id).first
    end
  end
end
