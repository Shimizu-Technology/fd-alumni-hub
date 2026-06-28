require "test_helper"

class ClassArchiveTest < ActiveSupport::TestCase
  test "syncs known team aliases to represented classes" do
    tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )

    mmx = tournament.teams.create!(class_year_label: "MMX", display_name: "MMX")
    gametime = tournament.teams.create!(class_year_label: "GAMETIME", display_name: "GAMETIME")
    twelve_pack = tournament.teams.create!(class_year_label: "12 Pack", display_name: "12 Pack")
    unknown = tournament.teams.create!(class_year_label: "435", display_name: "435")

    ClassArchive::Backfill.call

    assert_equal [ 2010 ], mmx.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ 2007 ], gametime.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ 2012, 2017 ], twelve_pack.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_empty unknown.reload.class_cohorts
  end

  test "credits shared titles to each represented class" do
    TournamentChampion.create!(year: 2024, slug: "2024", champion_label: "Class of 2016/17", champion_key: "16/17", source: "test", position: 1)

    ClassArchive::Backfill.call

    champion = TournamentChampion.find_by!(slug: "2024")
    assert_equal [ 2016, 2017 ], champion.class_cohorts.order(:graduation_year).map(&:graduation_year)

    counts = TournamentChampion.title_counts.index_by { |entry| entry[:championKey] }
    assert_equal 1, counts.fetch("16").fetch(:titles)
    assert_equal 1, counts.fetch("17").fetch(:titles)
  end
end
