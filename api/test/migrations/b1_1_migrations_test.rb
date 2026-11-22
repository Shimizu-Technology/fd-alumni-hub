require "test_helper"
require Rails.root.join("db/migrate/20261122000008_add_tournament_core_fields_to_games_and_standings")

class B11MigrationsTest < ActiveSupport::TestCase
  test "migration 000008 URL normalization upgrades valid links and clears unsafe ones" do
    migration = AddTournamentCoreFieldsToGamesAndStandings.new

    assert_equal "https://guamtime.net/events/fd", migration.send(:normalize_legacy_https_url, "guamtime.net/events/fd")
    assert_equal "https://guamtime.net/events/fd", migration.send(:normalize_legacy_https_url, "http://guamtime.net/events/fd")
    assert_equal "https://clutchguam.com/live", migration.send(:normalize_legacy_https_url, "//clutchguam.com/live")
    assert_equal "https://example.com/ok", migration.send(:normalize_legacy_https_url, "  https://example.com/ok  ")

    assert_nil migration.send(:normalize_legacy_https_url, "javascript:alert(1)")
    assert_nil migration.send(:normalize_legacy_https_url, "https://user:pass@evil.example/")
    assert_nil migration.send(:normalize_legacy_https_url, "mailto:test@example.com")
    assert_nil migration.send(:normalize_legacy_https_url, "not a valid url\nfoo")
  end

  test "migration 000008 infer_phase classifies fatherson, playoff, exhibition, and pool consistently with Game" do
    migration = AddTournamentCoreFieldsToGamesAndStandings.new
    stub = Struct.new(:notes, :bracket_code)

    assert_equal "fatherson", migration.send(:infer_phase, stub.new("phase=fatherson", nil))
    assert_equal "fatherson", migration.send(:infer_phase, stub.new(nil, "FS01"))
    assert_equal "playoff", migration.send(:infer_phase, stub.new("phase=playoff", nil))
    assert_equal "playoff", migration.send(:infer_phase, stub.new(nil, "MSF1"))
    assert_equal "exhibition", migration.send(:infer_phase, stub.new("phase=exhibition", nil))
    assert_equal "pool", migration.send(:infer_phase, stub.new("phase=pool", "G1"))
    assert_equal "pool", migration.send(:infer_phase, stub.new(nil, nil))
  end

  test "migration 000007 down raises IrreversibleMigration" do
    require Rails.root.join("db/migrate/20261122000007_scope_divisions_to_tournaments")
    assert_raises(ActiveRecord::IrreversibleMigration) { ScopeDivisionsToTournaments.new.down }
    assert_raises(ActiveRecord::IrreversibleMigration) { AddTournamentCoreFieldsToGamesAndStandings.new.down }
  end
end
