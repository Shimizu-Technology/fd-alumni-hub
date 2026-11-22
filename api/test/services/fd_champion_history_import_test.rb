require "test_helper"

class FdChampionHistoryImportTest < ActiveSupport::TestCase
  test "imports corrected runners-up and 2026 division champions idempotently" do
    result = DataImport::FdChampionHistoryImport.call

    assert_equal 45, result[:imported]
    assert_equal 45, TournamentChampion.count

    assert_equal "Class of 2002/04", TournamentChampion.find_by!(slug: "2021").runner_up_label
    assert_equal "Class of 2020", TournamentChampion.find_by!(slug: "2022").runner_up_label
    assert_equal "Class of 2013", TournamentChampion.find_by!(slug: "2024").runner_up_label

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
end
