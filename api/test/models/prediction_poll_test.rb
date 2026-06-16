require "test_helper"

class PredictionPollTest < ActiveSupport::TestCase
  setup do
    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2026,
      start_date: Date.new(2026, 7, 3),
      end_date: Date.new(2026, 7, 24),
      status: "upcoming"
    )
    @away = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division: "Maroon")
    @home = @tournament.teams.create!(class_year_label: "2016", display_name: "Class of 2016", division: "Maroon")
    @game = @tournament.games.create!(home_team: @home, away_team: @away, start_time: Time.zone.local(2026, 7, 3, 18, 30), status: "scheduled")
    @poll = @tournament.prediction_polls.create!(game: @game, poll_type: "game", question: "Who wins this game?")
  end

  test "api_json uses preloaded prediction votes for selected vote and totals" do
    voter_hash = PredictionVote.token_hash("device-1")
    @poll.prediction_votes.create!(team: @away, voter_token_hash: voter_hash)
    @poll.prediction_votes.create!(team: @home, voter_token_hash: PredictionVote.token_hash("device-2"))
    poll = PredictionPoll.includes(:prediction_votes, game: [ :home_team, :away_team ]).find(@poll.id)

    payload = nil
    queries = capture_sql do
      payload = poll.api_json(voter_token_hash: voter_hash)
    end

    prediction_vote_queries = queries.select { |sql| sql.include?("prediction_votes") }
    assert_empty prediction_vote_queries
    assert_equal @away.id.to_s, payload[:selectedTeamId]
    assert_equal 2, payload[:totalVotes]
    assert_equal 1, payload[:options].find { |option| option[:teamId] == @away.id.to_s }[:votes]
  end

  private

  def capture_sql
    queries = []
    subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |_name, _started, _finished, _id, payload|
      next if payload[:name] == "SCHEMA" || payload[:cached]

      queries << payload[:sql]
    end
    yield
    queries
  ensure
    ActiveSupport::Notifications.unsubscribe(subscriber) if subscriber
  end
end
