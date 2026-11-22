require "test_helper"

class FdChampionHistoryImportTest < ActiveSupport::TestCase
  test "imports corrected runners-up and 2026 division champions idempotently" do
    result = DataImport::FdChampionHistoryImport.call

    assert_equal 50, result[:imported]
    assert_equal 50, TournamentChampion.count

    assert_equal "Class of 2002/04", TournamentChampion.find_by!(slug: "2021").runner_up_label
    assert_equal "Class of 2020", TournamentChampion.find_by!(slug: "2022-maroon").runner_up_label
    assert_equal "Class of 2013", TournamentChampion.find_by!(slug: "2024-maroon").runner_up_label

    maroon_2026 = TournamentChampion.find_by!(slug: "2026-maroon")
    assert_equal "Class of 2025", maroon_2026.champion_label
    assert_equal "Class of 2013", maroon_2026.runner_up_label
    assert_equal "61-49", maroon_2026.score
    assert_equal "maroon", maroon_2026.bracket
    assert_equal true, maroon_2026.primary

    gold_2026 = TournamentChampion.find_by!(slug: "2026-gold")
    assert_equal "Class of 1999/01/03", gold_2026.champion_label
    assert_equal "Class of 2005", gold_2026.runner_up_label
    assert_equal "gold", gold_2026.bracket
    assert_equal false, gold_2026.primary
    assert_equal [ 1999, 2001, 2003 ], gold_2026.class_cohorts.order(:graduation_year).map(&:graduation_year)

    platinum_2026 = TournamentChampion.find_by!(slug: "2026-platinum")
    assert_equal "Class of 1991", platinum_2026.champion_label
    assert_equal "Class of 1988", platinum_2026.runner_up_label
    assert_equal "41-20", platinum_2026.score
    assert_equal "platinum", platinum_2026.bracket
    assert_equal false, platinum_2026.primary

    counts = TournamentChampion.title_counts.index_by { |entry| entry[:championKey] }
    assert_equal 1, counts.fetch("25").fetch(:titles)
    assert_nil counts["99"]

    assert_no_difference -> { TournamentChampion.count } do
      DataImport::FdChampionHistoryImport.call
    end
  end

  test "rekeys existing Maroon crowns and preserves their primary records and credits" do
    years = [ 2018, 2019, 2022, 2023, 2024, 2025 ]
    original = years.index_with do |year|
      TournamentChampion.create!(slug: year.to_s, year: year, bracket: "overall", primary: true,
        champion_label: "Class of 2006", status: "completed", source: "Archive")
    end

    2.times { DataImport::FdChampionHistoryImport.call }

    years.each do |year|
      champion = original.fetch(year).reload
      assert_equal "#{year}-maroon", champion.slug
      assert_equal [ champion.id ], TournamentChampion.primary_titles.where(year: year).ids
      assert_nil TournamentChampion.find_by(slug: year.to_s)
    end

    assert_equal "Leon Shimizu", original.fetch(2024).mvp_name
    assert_equal [ 2016, 2017 ], original.fetch(2024).class_cohorts.order(:graduation_year).pluck(:graduation_year)
    assert_equal [ 2018, 2019, 2022, 2023, 2024, 2026 ], TournamentChampion.where(bracket: "gold", primary: false).order(:year).pluck(:year)
    assert_includes TournamentChampion.find_by!(slug: "2023-gold").mvp_note, "Frankie Perez"
    assert_includes TournamentChampion.find_by!(slug: "2022-gold").mvp_note, "Romeo Sanchez"
  end
end
