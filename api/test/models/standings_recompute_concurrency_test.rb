require "test_helper"

class StandingsRecomputeConcurrencyTest < ActiveSupport::TestCase
  self.use_transactional_tests = false

  setup do
    @tournament = Tournament.create!(
      name: "FD Concurrency Test Tournament",
      year: 2099,
      start_date: Date.new(2099, 7, 1),
      end_date: Date.new(2099, 7, 20),
      status: "live"
    )
    @maroon = @tournament.divisions.create!(name: "Maroon", position: 1)
    @t1 = @tournament.teams.create!(class_year_label: "ConcA", display_name: "Conc Alpha", division_record: @maroon)
    @t2 = @tournament.teams.create!(class_year_label: "ConcB", display_name: "Conc Bravo", division_record: @maroon)
    @t3 = @tournament.teams.create!(class_year_label: "ConcC", display_name: "Conc Charlie", division_record: @maroon)
    @t4 = @tournament.teams.create!(class_year_label: "ConcD", display_name: "Conc Delta", division_record: @maroon)

    @g1 = @tournament.games.create!(home_team: @t1, away_team: @t2, division_record: @maroon, start_time: Time.zone.local(2099, 7, 1, 18, 0), status: "scheduled")
    @g2 = @tournament.games.create!(home_team: @t3, away_team: @t4, division_record: @maroon, start_time: Time.zone.local(2099, 7, 1, 19, 0), status: "scheduled")
  end

  teardown do
    @tournament&.destroy
  end

  test "concurrent recomputes inside tournament lock preserve both court results without unique conflicts" do
    errors = []
    barrier = Queue.new

    threads = [
      [ @g1.id, 70, 60 ],
      [ @g2.id, 65, 55 ]
    ].map do |game_id, home_score, away_score|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          Game.find(game_id).update!(status: "final", home_score: home_score, away_score: away_score)
          barrier << true
          Standings::Recompute.call(@tournament)
        end
      rescue => e
        errors << e
      end
    end

    threads.each(&:join)
    assert_empty errors

    # Final state must contain all 4 teams with exact unique ranks 1..4 and both games counted
    Standings::Recompute.call(@tournament)
    standings = @tournament.standings.ranked.to_a
    assert_equal 4, standings.length
    assert_equal [ 1, 2, 3, 4 ], standings.map(&:division_rank)
    assert_equal 2, standings.sum(&:wins)
    assert_equal 2, standings.sum(&:losses)
  end
end
