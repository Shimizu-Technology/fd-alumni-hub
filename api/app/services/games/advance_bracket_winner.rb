module Games
  class AdvanceBracketWinner
    Result = Struct.new(:advanced, :reason, :next_game_id, :slot, :winner_team_id, keyword_init: true) do
      def advanced?
        advanced == true
      end

      def api_json
        {
          advanced: advanced?,
          reason: reason,
          nextGameId: next_game_id&.to_s,
          slot: slot,
          winnerTeamId: winner_team_id&.to_s
        }.compact
      end
    end

    def self.call(game)
      new(game).call
    end

    def initialize(game)
      @game = game
    end

    def call
      return skip("no_next_game") if @game.next_game_id.blank?

      ActiveRecord::Base.transaction do
        # Lock feeder and target in deterministic primary-key order to prevent deadlocks
        # and ensure winner computation uses committed state rather than stale memory.
        locked_ids = [ @game.id, @game.next_game_id ].compact.uniq.sort
        locked_by_id = Game.where(id: locked_ids).order(:id).lock.index_by(&:id)

        feeder = locked_by_id[@game.id]
        return skip("feeder_not_found") unless feeder
        return skip("no_next_game") if feeder.next_game_id.blank?
        return skip("invalid_slot") unless Game::NEXT_GAME_SLOTS.include?(feeder.next_game_slot)
        return skip("not_final") unless feeder.status == "final"
        return skip("placeholder_feeder") if feeder.placeholder?
        return skip("missing_scores") if feeder.home_score.nil? || feeder.away_score.nil?
        return skip("tied_score") if feeder.home_score == feeder.away_score

        winner_id, loser_id =
          if feeder.home_score > feeder.away_score
            [ feeder.home_team_id, feeder.away_team_id ]
          else
            [ feeder.away_team_id, feeder.home_team_id ]
          end

        return skip("invalid_teams") if winner_id.blank? || loser_id.blank? || winner_id == loser_id

        next_game = locked_by_id[feeder.next_game_id] || Game.lock.find_by(id: feeder.next_game_id)
        return skip("next_game_not_found") unless next_game
        return skip("tournament_mismatch") unless next_game.tournament_id == feeder.tournament_id
        return skip("next_game_not_scheduled") unless next_game.status == "scheduled"

        slot = feeder.next_game_slot
        target_team_id = slot == "home" ? next_game.home_team_id : next_game.away_team_id
        opposite_team_id = slot == "home" ? next_game.away_team_id : next_game.home_team_id
        target_team = target_team_id ? Team.find_by(id: target_team_id) : nil

        return skip("winner_already_in_opposite_slot") if opposite_team_id == winner_id

        can_replace = target_team.nil? ||
          target_team.placeholder_team? ||
          target_team.id == loser_id ||
          target_team.id == winner_id

        return skip("slot_occupied_by_other_team") unless can_replace

        if slot == "home"
          next_game.home_team_id = winner_id
        else
          next_game.away_team_id = winner_id
        end

        home_team = Team.find_by(id: next_game.home_team_id)
        away_team = Team.find_by(id: next_game.away_team_id)
        both_real = home_team.present? && away_team.present? &&
          !home_team.placeholder_team? && !away_team.placeholder_team?

        next_game.placeholder = false if both_real
        next_game.save!

        Result.new(
          advanced: true,
          reason: nil,
          next_game_id: next_game.id,
          slot: slot,
          winner_team_id: winner_id
        )
      end
    end

    private

    def skip(reason)
      Result.new(advanced: false, reason: reason)
    end
  end
end
