require "test_helper"

class DivisionTest < ActiveSupport::TestCase
  setup do
    @t2026 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "live"
    )
    @t2027 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 7, 2),
      end_date: Date.new(2027, 7, 23),
      status: "upcoming"
    )
  end

  test "default division names match canonical tournament divisions" do
    assert_equal %w[Maroon Gold Platinum Special], Division::DEFAULT_NAMES
  end

  test "ensure_default_divisions! creates idempotent per-tournament divisions and reuses renamed slugs" do
    @t2026.ensure_default_divisions!
    @t2026.divisions.find_by!(name: "Maroon").update!(slug: "maroon-open")
    @t2026.ensure_default_divisions!

    assert_equal %w[Maroon Gold Platinum Special], @t2026.divisions.ordered.pluck(:name)
    assert_equal "maroon-open", @t2026.divisions.find_by!(name: "Maroon").slug
    assert_equal true, @t2026.divisions.find_by!(name: "Maroon").counts_for_standings?
    assert_equal false, @t2026.divisions.find_by!(name: "Special").counts_for_standings?
  end

  test "same division name and slug are allowed across different tournaments but unique within one" do
    d1 = @t2026.divisions.create!(name: "Maroon", position: 1)
    d2 = @t2027.divisions.create!(name: "Maroon", position: 1)
    assert_equal d1.slug, d2.slug

    dup = @t2026.divisions.build(name: "maroon", position: 2)
    assert_not dup.valid?
    assert_includes dup.errors[:name], "has already been taken"
  end

  test "tournament_id cannot be changed on update" do
    division = @t2026.divisions.create!(name: "Maroon", position: 1)
    division.tournament = @t2027

    assert_not division.valid?
    assert_includes division.errors[:tournament_id], "cannot be changed once created"
  end

  test "teams and games reject divisions belonging to another tournament" do
    d2027 = @t2027.divisions.create!(name: "Platinum", position: 1)
    team = @t2026.teams.build(class_year_label: "2016", display_name: "Class of 2016", division_record: d2027)
    assert_not team.valid?
    assert_includes team.errors[:division_id], "must belong to the same tournament"

    d2026 = @t2026.divisions.create!(name: "Maroon", position: 1)
    home = @t2026.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: d2026)
    away = @t2026.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: d2026)
    game = @t2026.games.build(home_team: home, away_team: away, start_time: Time.zone.local(2026, 7, 3, 18, 0), division_record: d2027)
    assert_not game.valid?
    assert_includes game.errors[:division_id], "must belong to the same tournament"
  end

  test "toggling counts_for_standings recomputes tournament standings" do
    maroon = @t2026.divisions.create!(name: "Maroon", position: 1, counts_for_standings: true)
    t1 = @t2026.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division_record: maroon)
    t2 = @t2026.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: maroon)
    @t2026.games.create!(home_team: t1, away_team: t2, division_record: maroon, start_time: Time.zone.local(2026, 7, 3, 18, 0), status: "final", home_score: 60, away_score: 50)
    Standings::Recompute.call(@t2026)
    assert_equal 2, @t2026.standings.count

    maroon.update!(counts_for_standings: false)
    assert_equal 0, @t2026.standings.reload.count
  end
end
