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
    pack_twelve = tournament.teams.create!(class_year_label: "Pack 12", display_name: "Pack 12")
    shortened_four_thirty_five = tournament.teams.create!(class_year_label: "435", display_name: "435")
    multi_year = tournament.teams.create!(class_year_label: "99/01/03", display_name: "99/01/03")
    ad7 = tournament.teams.create!(class_year_label: "AD7", display_name: "AD7")
    combined_ad7 = tournament.teams.create!(class_year_label: "82/86/AD7", display_name: "82/86/AD7")
    eight_fifteen = tournament.teams.create!(class_year_label: "815", display_name: "815")
    unknown = tournament.teams.create!(class_year_label: "XYZ", display_name: "XYZ")

    ClassArchive::Backfill.call

    assert_equal [ 2010 ], mmx.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ 2007 ], gametime.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ 2012, 2017 ], twelve_pack.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal [ 2012, 2017 ], pack_twelve.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal "430-5", shortened_four_thirty_five.reload.display_name
    assert_equal [ 1990, 1993, 1994, 1995 ], shortened_four_thirty_five.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal [ 1999, 2001, 2003 ], multi_year.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal [ 1987 ], ad7.reload.class_cohorts.map(&:graduation_year)
    assert_equal [ 1982, 1986, 1987 ], combined_ad7.reload.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal "08/15", eight_fifteen.reload.display_name
    assert_equal [ 2008, 2015 ], eight_fifteen.class_cohorts.order(:graduation_year).map(&:graduation_year)
    assert_equal %w[90 93 94 95], ClassArchive::Resolver.class_keys("430-5")
    assert_equal %w[90 93 94 95], ClassArchive::Resolver.class_keys("435")
    assert_equal %w[82 86 87], ClassArchive::Resolver.class_keys("82/86/AD7")
    assert_equal %w[08 15], ClassArchive::Resolver.class_keys("815")
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
