require "test_helper"
require Rails.root.join("db/migrate/20261123000007_add_optional_player_stats")

class AddOptionalPlayerStatsTest < ActiveSupport::TestCase
  test "migration reverses and reinstalls capture with tournament and results area" do
    tournament = Tournament.create!(name: "Migration cup", year: 2037, start_date: "2037-07-01", end_date: "2037-07-15")
    home = tournament.teams.create!(display_name: "Home", class_year_label: "Home")
    away = tournament.teams.create!(display_name: "Away", class_year_label: "Away")
    player = home.roster_entries.create!(name: "Player")
    game = tournament.games.create!(home_team: home, away_team: away, start_time: Time.current)
    db = ActiveRecord::Base.connection

    ActiveRecord::Migration.suppress_messages do
      migration = AddOptionalPlayerStats.new
      migration.migrate(:down)
      refute db.table_exists?(:player_game_stats)
      refute db.column_exists?(:games, :box_score_status)
      refute db.column_exists?(:tournaments, :enable_player_stats)
      db.execute("UPDATE games SET venue = 'Rollback court' WHERE id = #{game.id}")
      assert AuditEvent.where(record_type: "Game", record_id: game.id.to_s).exists?(action: "update")
      migration.migrate(:up)
    end

    assert_equal false, tournament.reload.enable_player_stats?
    assert_equal "none", game.reload.box_score_status
    row = PlayerGameStat.create!(game: game, team: home, roster_entry: player, points: 0)
    event = AuditEvent.find_by!(record_type: "PlayerGameStat", record_id: row.id.to_s)
    assert_equal [ tournament.id, "results", "create", 0 ],
      [ event.tournament_id, event.area, event.action, event.after_json["points"] ]

    row.destroy!
    assert AuditEvent.where(record_type: "PlayerGameStat", record_id: row.id.to_s, tournament_id: tournament.id).exists?(action: "delete")
  end
end
