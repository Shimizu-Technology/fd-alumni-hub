require "test_helper"

class TeamTest < ActiveSupport::TestCase
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @team = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
  end

  test "api json omits rosters unless requested" do
    @team.roster_entries.create!(name: "Juan Duenas", jersey_number: "10")

    assert_not @team.api_json.key?(:rosterEntries)
    assert_equal "Juan Duenas", @team.api_json(include_roster: true).dig(:rosterEntries, 0, :name)
  end
end
