require "test_helper"
require_relative "../../db/migrate/20261123000004_create_site_publications"

class SiteModeResolverTest < ActiveSupport::TestCase
  test "each empty mode keeps history and rejects forced sections without content" do
    SitePublication::MODES.each do |mode|
      overrides = SitePublication::SECTIONS.index_with("show")
      resolver = SiteMode::Resolver.preview(mode: mode, section_overrides: overrides)
      payload = resolver.as_json

      assert_equal mode, payload[:mode]
      assert payload[:isPreview]
      assert_not payload[:schedulePublished]
      assert payload[:sections].values.none?
      assert_includes payload[:navItems].pluck(:to), "/history"
      assert_includes 3..4, payload[:mobileBottomNav].size
      assert resolver.readiness.fetch(mode.to_sym).any?
    end
  end

  test "preview resolves published content and applies automatic, show and hide overrides" do
    season = Tournament.create!(name: "Season", year: 2090, start_date: Date.current, end_date: Date.current, status: "live")
    home = season.teams.create!(display_name: "Class of 2016", class_year_label: "2016", division: "Maroon")
    away = season.teams.create!(display_name: "Class of 2017", class_year_label: "2017", division: "Maroon")
    season.games.create!(home_team: home, away_team: away, start_time: Time.current, phase: "playoff", bracket_round: "final", bracket_slot: 1)
    season.games.create!(home_team: home, away_team: away, start_time: 1.hour.ago, phase: "pool", status: "final", home_score: 72, away_score: 70)

    expected = { "fundraising" => [], "schedule_ready" => %w[bracket schedule teams], "tournament_live" => %w[bracket schedule standings tonight], "tournament_recap" => %w[recap] }
    expected.each do |mode, sections|
      preview = SiteMode::Resolver.preview(mode: mode, tournament_id: season.id, publish_schedule: true, recap_headline: "Season champions")
      assert_equal sections.sort, preview.sections.select { |_, visible| visible }.keys.sort
      assert_equal "tournament_live", preview.suggested_mode
    end
    overrides = { "bracket" => "hide", "teams" => "show", "schedule" => "auto" }
    draft = SiteMode::Resolver.preview(mode: "tournament_live", tournament_id: season.id, section_overrides: overrides)
    assert draft.sections.values.none?
    proposed = SiteMode::Resolver.preview(mode: "tournament_live", tournament_id: season.id, section_overrides: overrides, publish_schedule: true)
    assert proposed.sections.fetch("teams")
    assert proposed.sections.fetch("schedule")
    assert_not proposed.sections.fetch("bracket")
    assert_nil season.reload.schedule_published_at
    assert_equal 0, SitePublication.count
  end

  test "migration rolls back and backfills only seasons with legacy public content" do
    connection = Tournament.connection
    connection.transaction(requires_new: true) do
      attributes = { name: "Legacy season", start_date: Date.current, end_date: Date.current }
      live = Tournament.create!(**attributes, year: 2080, status: "live")
      completed = Tournament.create!(**attributes, year: 2081, status: "completed")
      draft = Tournament.create!(**attributes, year: 2082)
      scheduled = Tournament.create!(**attributes, year: 2083)
      home = scheduled.teams.create!(display_name: "Class of 2016", class_year_label: "2016")
      away = scheduled.teams.create!(display_name: "Class of 2017", class_year_label: "2017")
      scheduled.games.create!(home_team: home, away_team: away, start_time: Time.current)

      migration = CreateSitePublications.new
      migration.migrate(:down)
      refute connection.table_exists?(:site_publications)
      refute connection.column_exists?(:tournaments, :schedule_revision)

      migration.migrate(:up)
      assert connection.table_exists?(:site_publications)
      assert connection.column_exists?(:tournaments, :schedule_revision)
      [ live, completed, scheduled ].each do |season|
        assert_equal 1, season.reload.schedule_revision
        assert_in_delta season.updated_at, season.schedule_published_at, 1.second
      end
      assert_equal 0, draft.reload.schedule_revision
      assert_nil draft.schedule_published_at

      publication = SitePublication.create!(mode: "fundraising", version_number: 1, published_at: Time.current, current: true)
      assert AuditEvent.exists?(record_type: "SitePublication", record_id: publication.id.to_s, area: "site_mode")
      raise ActiveRecord::Rollback
    end
  end
end
