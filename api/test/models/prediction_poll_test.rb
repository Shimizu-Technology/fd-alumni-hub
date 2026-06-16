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

  test "allows only one tournament prediction poll per tournament" do
    @tournament.prediction_polls.create!(poll_type: "tournament", question: "Who wins the tournament?")
    duplicate = @tournament.prediction_polls.build(poll_type: "tournament", question: "Who wins it now?")

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:poll_type], "already has a tournament prediction poll"
  end

  test "database has unique tournament prediction poll index" do
    index = ActiveRecord::Base.connection.indexes(:prediction_polls).find do |candidate|
      candidate.name == "index_prediction_polls_on_unique_tournament_poll"
    end

    assert index
    assert index.unique
    assert_equal [ "tournament_id", "poll_type" ], index.columns
    assert_match "tournament", index.where.to_s
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
