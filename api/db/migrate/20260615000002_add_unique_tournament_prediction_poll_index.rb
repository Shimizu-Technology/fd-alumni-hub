class AddUniqueTournamentPredictionPollIndex < ActiveRecord::Migration[8.1]
  def up
    remove_index :prediction_polls, name: "index_prediction_polls_on_tournament_id_and_poll_type", if_exists: true
    add_index :prediction_polls,
      [ :tournament_id, :poll_type ],
      unique: true,
      where: "poll_type = 'tournament'",
      name: "index_prediction_polls_on_unique_tournament_poll"
  end

  def down
    remove_index :prediction_polls, name: "index_prediction_polls_on_unique_tournament_poll", if_exists: true
    add_index :prediction_polls, [ :tournament_id, :poll_type ], name: "index_prediction_polls_on_tournament_id_and_poll_type"
  end
end
