require "test_helper"

class FdEnrichedArchiveImportTest < ActiveSupport::TestCase
  test "enriches a populated archive and reruns without duplicate seasons, games, media, or champions" do
    DataImport::Fd2026ScheduleImport.call
    scheduled = Tournament.find_by!(year: 2026).games.find_by!(game_number: "57")
    original_time = scheduled.start_time
    corrected = incorrect_2025_game
    preserved = incorrect_2025_game(home_score: 62)

    first = DataImport::FdEnrichedArchiveImport.call
    assert_equal({ tournaments: 16, articles: 25, videos: 33, games: 52 }, first)

    [ Tournament, Team, Game, ArticleLink, MediaAsset, TournamentChampion, TournamentChampionCredit, TeamClassMembership ].tap do |models|
      before = models.map { |model| model.order(:id).ids }
      assert_equal first, DataImport::FdEnrichedArchiveImport.call
      assert_equal before, models.map { |model| model.order(:id).ids }
    end

    assert_equal Time.zone.local(2025, 7, 2, 18, 30), corrected.reload.start_time
    assert_equal Time.zone.local(2025, 7, 10, 18, 30), preserved.reload.start_time
    assert_equal [ 2025 ], Tournament.where(year: 2025).pluck(:year)
    assert_equal [ original_time, "final", 42, 46 ], scheduled.reload.attributes.values_at("start_time", "status", "home_score", "away_score")
    assert_includes scheduled.api_json[:topPerformers], "Michael Sakazaki 18 pts"
    assert_not scheduled.api_json[:dateOnly]
    assert_equal 31, Tournament.find_by!(year: 2023).games.count

    season = scheduled.tournament.reload
    assert_equal [ "completed", "Summer of Sixteen", 43, "16" ], [ season.status, season.theme, season.edition_number, season.host_class_cohort.key ]
    gold = season.games.find_by!(bracket_round: "final", division: "Gold")
    assert_equal "overtime", gold.result_outcome
    assert_equal gold.home_team_id, gold.official_winner_team_id
    assert_nil gold.home_score
    assert_nil gold.away_score
    assert gold.api_json[:dateOnly]
    assert_includes gold.status_note, "exact score in full video"

    shootout = Tournament.find_by!(year: 2023).games.find_by!(result_outcome: "shootout")
    assert_equal [ 27, 27, shootout.home_team_id ], [ shootout.home_score, shootout.away_score, shootout.official_winner_team_id ]
  end

  test "imports all verified YouTube IDs and links recaps and highlights" do
    DataImport::FdEnrichedArchiveImport.call
    videos = MediaAsset.where(media_type: "video")
    assert_equal 33, videos.count
    expected = JSON.parse(DataImport::FdEnrichedArchiveImport::DEFAULT_PATH.read).fetch("seasons").flat_map { |season| season.fetch("videos", []) }
    assert_equal expected.pluck("externalVideoId").sort, videos.pluck(:external_video_id).sort
    videos.find_each do |video|
      assert video.valid?
      assert_equal "https://www.youtube-nocookie.com/embed/#{video.external_video_id}", video.api_json[:embedUrl]
    end

    highlights = TournamentChampion.where.not(highlight_video_id: nil).includes(:highlight_video).to_h do |champion|
      [ champion.slug, champion.highlight_video.external_video_id ]
    end
    assert_equal({
      "2008" => "LIIbnqa9k5E", "2015" => "Qp_wb3k8N54", "2016" => "n2lw-cEOlRU", "2018-maroon" => "n_KoNH6ENJ8",
      "2021" => "ARI1hJc1Qyo", "2022-maroon" => "zaNPeQqlW1o", "2026-gold" => "gExNQKCX60E"
    }, highlights)

    [ "2008", "2012", "2013", "2014", "2015", "2017", "2018-maroon", "2019-maroon", "2021", "2022-maroon",
      "2023-maroon", "2024-maroon", "2025-maroon", "2026-maroon", "2026-gold", "2026-platinum" ].each do |slug|
      champion = TournamentChampion.find_by!(slug: slug)
      assert_equal champion.source_url, champion.recap_article.url
      assert_equal champion.tournament_id, champion.recap_article.tournament_id
    end
    assert_equal 18, TournamentChampion.find_by!(slug: "2026-maroon").recap_article.photo_count
  end

  test "historical data contains no private contact or chat information" do
    files = [
      DataImport::FdEnrichedArchiveImport::DEFAULT_PATH, DataImport::FdChampionHistoryImport::DEFAULT_PATH,
      ClassArchive::Resolver::DEFAULT_ALIAS_PATH
    ]
    files.each do |file|
      data = file.read
      assert_no_match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, data, file.basename.to_s)
      assert_no_match(/(?<!\w)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\w)/, data, file.basename.to_s)
      assert_no_match(/chat\.whatsapp\.com|"(?:privateChat|chatName|phone|email|contact)"\s*:/i, data, file.basename.to_s)
    end
  end

  private

  def incorrect_2025_game(home_score: 63)
    season = Tournament.find_or_create_by!(year: 2025, name: "FD Alumni") do |tournament|
      tournament.assign_attributes(start_date: "2025-06-27", end_date: "2025-07-18", status: "completed")
    end
    home = season.teams.find_or_create_by!(display_name: "Class of 2025", class_year_label: "2025")
    away = season.teams.find_or_create_by!(display_name: "Class of 2013", class_year_label: "2013")
    season.games.create!(home_team: home, away_team: away, start_time: Time.zone.local(2025, 7, 10, 18, 30),
      status: "final", home_score: home_score, away_score: 70)
  end
end
