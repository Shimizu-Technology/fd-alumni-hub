require "json"

module DataImport
  class FdEnrichedArchiveImport
    DEFAULT_PATH = Rails.root.join("..", "data", "historical", "fd-enriched-archive-2008-2026.json")

    def self.call(path: DEFAULT_PATH)
      new(Pathname(path)).call
    end

    def initialize(path)
      @data = JSON.parse(path.read)
    end

    def call
      Audit::Context.with do
        Tournament.transaction do
          # Serialize archive runs because tournament year alone is not a unique key.
          FdChampionHistoryImport.lock_archive!
          seasons = @data.fetch("seasons")
          tournaments = seasons.to_h do |season|
            tournament = import_tournament(season.fetch("tournament"))
            [ tournament.year, tournament ]
          end

          FdChampionHistoryImport.call
          @data.fetch("dateCorrections", []).each do |entry|
            correct_game_date(tournaments.fetch(entry.fetch("year")), entry)
          end
          seasons.each { |season| import_season(tournaments.fetch(season.dig("tournament", "year")), season) }

          {
            tournaments: tournaments.size,
            articles: entry_count(seasons, "articles"),
            videos: entry_count(seasons, "videos"),
            games: entry_count(seasons, "games")
          }
        end
      end
    end

    private

    def import_tournament(entry)
      year = entry.fetch("year")
      tournament = Tournament.where(year: year).order(:start_date, :id).first_or_initialize
      tournament.assign_attributes(
        name: entry.fetch("name", tournament.name.presence || "FD Alumni Basketball Tournament"),
        start_date: entry.fetch("startDate"), end_date: entry.fetch("endDate"),
        status: entry.fetch("status"), host_class_label: entry.fetch("hostClassLabel"),
        host_class_cohort: ClassArchive::Resolver.resolve_cohorts(entry.fetch("hostClassKey")).first
      )
      tournament.edition_number = entry["editionNumber"] if entry.key?("editionNumber")
      tournament.theme = entry["theme"] if entry.key?("theme")
      tournament.save!
      tournament
    end

    def import_season(tournament, season)
      champions = TournamentChampion.where(tournament: tournament)
      season.fetch("articles", []).each { |entry| import_article(tournament, champions, entry) }
      season.fetch("videos", []).each { |entry| import_video(tournament, champions, entry) }

      games = season.fetch("games", [])
      return if games.empty?

      divisions = tournament.ensure_default_divisions!.index_by(&:slug)
      teams = tournament.teams.order(:id).to_a
      games.each do |entry|
        division = divisions.fetch(entry["divisionSlug"]) if entry["divisionSlug"].present?
        import_game(tournament, teams, entry, division)
      end
      Standings::Recompute.call(tournament)
    end

    def import_article(tournament, champions, entry)
      article = tournament.article_links.find_or_initialize_by(url: entry.fetch("url"))
      article.assign_attributes(
        title: entry.fetch("title"), source: entry.fetch("source"), kind: entry.fetch("kind"),
        division_slug: entry["divisionSlug"], photo_count: entry["photoCount"]
      )
      article.published_at = day_start(entry.fetch("publishedDate")) if entry.key?("publishedDate")
      article.save!
      champions.where(source_url: article.url).find_each { |champion| champion.update!(recap_article: article) }
    end

    def import_video(tournament, champions, entry)
      youtube_id = entry.fetch("externalVideoId")
      video = tournament.media_assets.find_or_initialize_by(external_video_id: youtube_id)
      video.update!(
        media_type: "video", video_provider: "youtube", video_url: "https://www.youtube.com/watch?v=#{youtube_id}",
        source: entry.fetch("source"), title: entry.fetch("title"), taken_at: day_start(entry.fetch("takenDate")),
        duration_seconds: entry.fetch("durationSeconds"), division_slug: entry["divisionSlug"]
      )
      return unless entry.key?("highlightBracket")

      champions.find_by!(bracket: entry.fetch("highlightBracket")).update!(highlight_video: video)
    end

    def import_game(tournament, teams, entry, division)
      home = team_for(tournament, teams, entry.fetch("home"), division)
      away = team_for(tournament, teams, entry.fetch("away"), division)
      day = day_start(entry.fetch("date"))
      game_number = entry["gameNumber"]
      game = (tournament.games.find_by("lower(game_number) = ?", game_number.downcase) if game_number)
      game ||= matchup_on(tournament, day, home.id, away.id).first
      game ||= tournament.games.build(
        home_team: home, away_team: away, start_time: day,
        game_number: game_number, legacy_id: historical_game_id(tournament, day, entry)
      )

      game.phase = entry.fetch("phase")
      game.status = "final"
      game.placeholder = false
      game.division_record = division if division
      game.bracket_round = entry.fetch("bracketRound") if entry.key?("bracketRound")
      game.status_note = entry.fetch("note") if entry.key?("note")
      if entry.key?("outcome") || entry["homeScore"]
        game.result_outcome = entry.fetch("outcome", "regulation")
        game.official_winner_team = { entry.fetch("home") => home, entry.fetch("away") => away }.fetch(entry["winner"], nil)
      end
      game.top_performers_json = entry.fetch("topPerformers") if entry.key?("topPerformers")
      if entry["homeScore"] && entry["awayScore"]
        scores = { home.id => entry.fetch("homeScore"), away.id => entry.fetch("awayScore") }
        game.home_score = scores.fetch(game.home_team_id)
        game.away_score = scores.fetch(game.away_team_id)
      end
      game.save!
    end

    def historical_game_id(tournament, day, entry)
      stamp = day.strftime("%m%d")
      teams = entry.values_at("home", "away").map(&:parameterize).sort
      "#{Game::ARCHIVE_GAME_PREFIX}#{[ tournament.year, stamp, *teams ].join('-')}"
    end

    def team_for(tournament, teams, label, division)
      key = ClassArchive::Resolver.class_key(label)
      existing = teams.find do |team|
        [ team.display_name, team.class_year_label ].any? do |name|
          name.casecmp?(label) || (key.present? && ClassArchive::Resolver.class_key(name) == key)
        end
      end
      return existing if existing

      display_name = if label == "430-5"
        "430-5"
      else
        classes = label.split("/")
        first = ClassArchive::Resolver.resolve_cohorts(classes.shift).first
        [ first.display_name, *classes ].join("/")
      end
      tournament.teams.create!(display_name: display_name, class_year_label: label, division_record: division).tap do |team|
        teams << team
      end
    end

    def correct_game_date(tournament, entry)
      classes = [ ClassArchive::Resolver.class_key(entry.fetch("home")), ClassArchive::Resolver.class_key(entry.fetch("away")) ]
      scores = [ entry.fetch("homeScore"), entry.fetch("awayScore") ]
      from = day_start(entry.fetch("from"))
      to = day_start(entry.fetch("to"))

      tournament.games.where(start_time: from...from.tomorrow).includes(:home_team, :away_team).find_each do |game|
        actual_classes = [ game.home_team, game.away_team ].map do |team|
          ClassArchive::Resolver.class_key(team.display_name).presence || ClassArchive::Resolver.class_key(team.class_year_label)
        end
        actual_scores = [ game.home_score, game.away_score ]
        next unless [ actual_classes, actual_scores ] == [ classes, scores ] ||
          [ actual_classes.reverse, actual_scores.reverse ] == [ classes, scores ]

        game.update!(start_time: game.start_time + (to - from))
      end
    end

    def matchup_on(tournament, day, home_id, away_id)
      games = tournament.games.where(start_time: day...day.tomorrow)
      games.where(home_team_id: home_id, away_team_id: away_id)
        .or(games.where(home_team_id: away_id, away_team_id: home_id)).order(:id)
    end

    def day_start(date)
      Time.zone.iso8601(date)
    end

    def entry_count(seasons, key)
      seasons.sum { |season| season.fetch(key, []).size }
    end
  end
end
