require "test_helper"
require Rails.root.join("db/migrate/20261122000010_standardize_sponsor_tiers")

class B13SponsorTiersMigrationTest < ActiveSupport::TestCase
  test "migration 000010 maps legacy tiers accurately and preserves title/presenting as diamond" do
    migration = StandardizeSponsorTiers.new

    assert_equal "diamond", migration.send(:normalize_tier, "Diamond")
    assert_equal "diamond", migration.send(:normalize_tier, "Title")
    assert_equal "diamond", migration.send(:normalize_tier, "Presenting")
    assert_equal "diamond", migration.send(:normalize_tier, "Presenting Sponsor")
    assert_equal "diamond", migration.send(:normalize_tier, "Title Sponsor")
    assert_equal "platinum", migration.send(:normalize_tier, "Platinum")
    assert_equal "gold", migration.send(:normalize_tier, "GOLD")
    assert_equal "silver", migration.send(:normalize_tier, "Silver")
    assert_equal "community", migration.send(:normalize_tier, "Community Partner")
    assert_equal "community", migration.send(:normalize_tier, "Bronze")
    assert_equal "community", migration.send(:normalize_tier, "   ")
    assert_equal "community", migration.send(:normalize_tier, nil)

    out, _err = capture_io do
      assert_equal "community", migration.send(:normalize_tier, "Legacy Special", sponsor_id: 42, sponsor_name: "Acme")
    end
    assert_includes out, "mapped unknown tier \"Legacy Special\" to 'community'"
    assert_includes out, "sponsor id=42"
  end

  test "migration 000010 normalizes sponsor URLs to HTTPS and clears unsafe values" do
    migration = StandardizeSponsorTiers.new

    assert_equal "https://bankofguam.com", migration.send(:normalize_legacy_https_url, "bankofguam.com")
    assert_equal "https://bankofguam.com/logo.png", migration.send(:normalize_legacy_https_url, "http://bankofguam.com/logo.png")
    assert_equal "https://cdn.example.com/logo.png", migration.send(:normalize_legacy_https_url, "//cdn.example.com/logo.png")

    out, _err = capture_io do
      assert_nil migration.send(:normalize_legacy_https_url, "javascript:alert(1)", field: "target_url", sponsor_id: 9)
      assert_nil migration.send(:normalize_legacy_https_url, "https://user:pass@evil.example/", field: "logo_url", sponsor_id: 9)
    end
    assert_includes out, "cleared invalid target_url"
    assert_includes out, "cleared invalid logo_url"
  end

  test "migration 000010 down raises IrreversibleMigration" do
    assert_raises(ActiveRecord::IrreversibleMigration) { StandardizeSponsorTiers.new.down }
  end
end
