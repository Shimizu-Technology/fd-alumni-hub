module Games
  class AdvanceBracketWinner
    Result = Struct.new(:advanced, :reason, :next_game_id, :slot, :winner_team_id,
      :needs_review, :affected_next_game, keyword_init: true) do
      def advanced?
        advanced == true
      end

      def api_json
        {
          advanced: advanced?,
          reason: reason,
          nextGameId: next_game_id&.to_s,
          slot: slot,
          winnerTeamId: winner_team_id&.to_s,
          needsReview: needs_review,
          affectedNextGame: affected_next_game
        }.compact
      end
    end

    def self.call(game, previous_winner_id: nil, reopened: false)
      return Result.new(advanced: false, reason: "no_next_game") unless game.next_game_id

      game.tournament.with_lock do
        new(Game.lock.find(game.id), previous_winner_id, reopened).call
      end
    end

    def initialize(feeder, previous_winner_id, reopened)
      @feeder = feeder
      @previous_winner_id = previous_winner_id
      @reopened = reopened
    end

    def call
      return skip("no_next_game") unless @feeder.next_game_id
      return skip("invalid_slot") unless Game::NEXT_GAME_SLOTS.include?(@feeder.next_game_slot)
      return skip("placeholder_feeder") if @feeder.result_placeholder? && !@reopened

      winner_id = @feeder.winner_team_id
      unless winner_id || @reopened
        return skip("not_final") unless @feeder.status == "final"
        return skip("missing_scores") unless @feeder.home_score && @feeder.away_score

        return skip("tied_score")
      end

      target = Game.lock.find_by(id: @feeder.next_game_id, tournament_id: @feeder.tournament_id)
      return skip("next_game_not_found") unless target

      slot = @feeder.next_game_slot
      target_team = slot == "home" ? target.home_team : target.away_team
      opposite = slot == "home" ? target.away_team : target.home_team
      if winner_id == target_team.id && target.status != "scheduled" &&
        (@previous_winner_id.nil? || @previous_winner_id == winner_id)
        return skip("winner_already_in_slot")
      end

      if target.status != "scheduled"
        return flag(target, "next_game_not_scheduled", "The next game is #{target.status}. Review the #{slot} matchup.")
      end
      if @reopened
        return skip("feeder_unfinalized") if target_team.placeholder_team?

        return flag(target, "feeder_unfinalized", "The feeder result was reopened. Review the #{slot} matchup.")
      end
      if opposite.id == winner_id
        return flag(target, "winner_already_in_opposite_slot", "The official winner is in the opposite slot.")
      end
      expected_ids = [ @feeder.home_team_id, @feeder.away_team_id, @previous_winner_id ]
      unless target_team.placeholder_team? || expected_ids.include?(target_team.id)
        return flag(target, "slot_occupied_by_other_team", "The #{slot} slot contains an unexpected team.")
      end

      target.public_send("#{slot}_team_id=", winner_id)
      target.placeholder = target.home_team.placeholder_team? || target.away_team.placeholder_team?
      if other_feeders_resolved?(target)
        target.bracket_needs_review = false
        target.bracket_exception_note = nil
      end
      target.save!
      Result.new(advanced: true, next_game_id: target.id, slot: slot, winner_team_id: winner_id)
    end

    private

    def other_feeders_resolved?(target)
      target.feeder_games.where.not(id: @feeder.id).all? do |other|
        team = other.next_game_slot == "home" ? target.home_team : target.away_team
        winner_id = other.winner_team_id
        winner_id ? team.id == winner_id : team.placeholder_team?
      end
    end

    def flag(target, reason, detail)
      note = "Feeder game #{@feeder.game_number || @feeder.id}: #{detail}"
      target.update!(bracket_needs_review: true, bracket_exception_note: note)
      Result.new(advanced: false, reason: reason, needs_review: true, affected_next_game: target.summary_json(include_bracket_review: true),
        next_game_id: target.id, slot: @feeder.next_game_slot)
    end

    def skip(reason)
      Result.new(advanced: false, reason: reason)
    end
  end
end
