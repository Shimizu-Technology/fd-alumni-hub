require "test_helper"

class PublicChampionsControllerTest < ActionDispatch::IntegrationTest
  test "returns class credit counts and original entry counts" do
    TournamentChampion.create!(year: 2009, slug: "2009", champion_label: "Class of 2002", champion_key: "02", source: "test", position: 1)
    TournamentChampion.create!(year: 2014, slug: "2014", champion_label: "Class of 2004", champion_key: "04", source: "test", position: 2)
    TournamentChampion.create!(year: 2022, slug: "2022", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 3)
    TournamentChampion.create!(year: 2025, slug: "2025", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 4)
    TournamentChampion.create!(year: 2025, slug: "2025-gold", champion_label: "Class of 1996", champion_key: "96", bracket: "gold", primary: false, source: "test", position: 5)

    ClassArchive::Backfill.call

    get "/api/v1/public/champions"

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal 5, body["championRecords"].length

    counts = body["titleCounts"].index_by { |entry| entry["championKey"] }
    assert_equal 3, counts.fetch("02").fetch("titles")
    assert_equal 3, counts.fetch("04").fetch("titles")
    assert_nil counts["02/04"]
    assert_nil counts["96"]

    entry_counts = body["entryTitleCounts"].index_by { |entry| entry["championKey"] }
    assert_equal 1, entry_counts.fetch("02").fetch("titles")
    assert_equal 1, entry_counts.fetch("04").fetch("titles")
    assert_equal 2, entry_counts.fetch("02/04").fetch("titles")
    assert_equal "overall", body.dig("championRecords", 0, "bracket")
    assert_equal true, body.dig("championRecords", 0, "primary")
  end

  test "filters champions by year" do
    TournamentChampion.create!(year: 2024, slug: "2024", champion_label: "Class of 2016/17", champion_key: "16/17", source: "test", position: 1)
    TournamentChampion.create!(year: 2025, slug: "2025", champion_label: "Class of 2002/04", champion_key: "02/04", source: "test", position: 2)

    get "/api/v1/public/champions", params: { year: 2024 }

    assert_response :success
    body = JSON.parse(response.body)
    assert_equal [ 2024 ], body["championRecords"].map { |record| record["year"] }
  end
end
