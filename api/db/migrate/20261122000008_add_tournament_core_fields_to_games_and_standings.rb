require "uri"

class AddTournamentCoreFieldsToGamesAndStandings < ActiveRecord::Migration[8.1]
  class MigrationGame < ActiveRecord::Base
    self.table_name = "games"
  end

  PLAYOFF_CODE_REGEX = /\A(?:[WL]?(?:MP|GP|PP)|[MGP]?(?:QF|SF|F)|L)\d*\z/i

  def up
    add_column :games, :phase, :string, default: "pool", null: false
    add_column :games, :game_number, :string
    add_column :games, :bracket_round, :string
    add_column :games, :bracket_slot, :integer
    add_reference :games, :next_game, foreign_key: { to_table: :games, on_delete: :nullify }, null: true
    add_column :games, :next_game_slot, :string
    add_column :games, :status_note, :string
    add_column :games, :lock_version, :integer, default: 0, null: false
    add_column :games, :last_score_mutation_id, :string
    add_column :games, :last_score_mutation_digest, :string
    add_reference :games, :score_updated_by, foreign_key: { to_table: :users, on_delete: :nullify }, null: true
    add_column :games, :score_updated_at, :datetime

    add_column :standings, :division_rank, :integer

    MigrationGame.reset_column_information

    used_numbers_by_tournament = Hash.new { |h, k| h[k] = {} }
    nulled_urls = []

    MigrationGame.order(:tournament_id, :start_time, :id).to_a.each do |game|
      phase = infer_phase(game)
      code = game.bracket_code.to_s.strip.presence
      game_number = nil
      if code.present?
        truncated = code.first(32)
        key = truncated.downcase
        unless used_numbers_by_tournament[game.tournament_id][key]
          used_numbers_by_tournament[game.tournament_id][key] = true
          game_number = truncated
        end
      end

      updates = { phase: phase }
      updates[:game_number] = game_number if game_number

      %i[stream_url ticket_url].each do |col|
        raw = game.read_attribute(col)
        next if raw.blank?

        normalized = normalize_legacy_https_url(raw)
        if normalized.nil?
          nulled_urls << "#{game.id}:#{col}"
          updates[col] = nil
        elsif normalized != raw
          updates[col] = normalized
        end
      end

      MigrationGame.where(id: game.id).update_all(updates)
    end

    if nulled_urls.any?
      say "Cleared #{nulled_urls.length} invalid legacy game URL(s): #{nulled_urls.first(20).join(', ')}"
    end

    add_check_constraint :games,
      "phase IN ('pool', 'playoff', 'fatherson', 'exhibition')",
      name: "chk_games_phase"
    add_check_constraint :games,
      "status IN ('scheduled', 'live', 'final', 'delayed', 'postponed', 'cancelled')",
      name: "chk_games_status"
    add_check_constraint :games,
      "bracket_round IS NULL OR bracket_round IN ('play_in', 'round_of_16', 'quarterfinal', 'semifinal', 'final', 'third_place')",
      name: "chk_games_bracket_round"
    add_check_constraint :games,
      "bracket_slot IS NULL OR bracket_slot > 0",
      name: "chk_games_bracket_slot_positive"
    add_check_constraint :games,
      "next_game_id IS NULL OR next_game_id <> id",
      name: "chk_games_next_game_not_self"
    add_check_constraint :games,
      "next_game_id IS NULL OR next_game_slot IN ('home', 'away')",
      name: "chk_games_next_game_slot_consistency"

    add_index :games, [ :tournament_id, :phase, :start_time ], name: "index_games_on_tournament_phase_start"
    add_index :games, "tournament_id, lower((game_number)::text)", unique: true, where: "(game_number IS NOT NULL)", name: "index_games_on_tournament_game_number_unique"
    add_index :games, [ :tournament_id, :division_id, :phase, :bracket_round, :bracket_slot ], name: "index_games_on_tournament_bracket"
    add_index :games, [ :next_game_id, :next_game_slot ], unique: true, where: "(next_game_id IS NOT NULL)", name: "index_games_on_next_game_slot_unique"

    add_index :standings, [ :tournament_id, :division_rank ], name: "index_standings_on_tournament_division_rank"
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Game URL normalization and phase backfill cannot be reversed automatically"
  end

  private

  def infer_phase(game)
    notes = game.notes.to_s
    code = game.bracket_code.to_s.strip
    return "fatherson" if notes.include?("phase=fatherson") || code.match?(/\AFS/i)
    return "playoff" if notes.include?("phase=playoff") || code.match?(PLAYOFF_CODE_REGEX)
    return "exhibition" if notes.include?("phase=exhibition")

    "pool"
  end

  def normalize_legacy_https_url(raw)
    value = raw.to_s.strip
    return nil if value.blank? || value.length > 2048 || value.match?(/[\r\n\t\0]/)

    candidate = if value.start_with?("//")
      "https:#{value}"
    elsif value.match?(/\Ahttp:\/\//i)
      value.sub(/\Ahttp:\/\//i, "https://")
    elsif value.match?(/\Ahttps:\/\//i)
      value
    elsif value.match?(/\A[a-z][a-z0-9+.-]*:/i)
      return nil
    else
      "https://#{value}"
    end

    uri = URI.parse(candidate)
    return nil unless uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.blank?

    uri.to_s
  rescue URI::InvalidURIError
    nil
  end
end
