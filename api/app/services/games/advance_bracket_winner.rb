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
      return skip("invalid_slot") unless Game::NEXT_GAME_SLOTS.include?(@game.next_game_slot)
      return skip("not_final") unless @game.status == "final"
      return skip("placeholder_feeder") if @game.placeholder?
      return skip("missing_scores") if @game.home_score.nil? || @game.away_score.nil?
      return skip("tied_score") if @game.home_score == @game.away_score

      winner_id, loser_id =
        if @game.home_score > @game.away_score
          [ @game.home_team_id, @game.away_team_id ]
        else
          [ @game.away_team_id, @game.home_team_id ]
        end

      return skip("invalid_teams") if winner_id.blank? || loser_id.blank? || winner_id == loser_id

      ActiveRecord::Base.transaction do
        next_game = Game.lock.includes(:home_team, :away_team).find_by(id: @game.next_game_id)
        return skip("next_game_not_found") unless next_game
        return skip("tournament_mismatch") unless next_game.tournament_id == @game.tournament_id
        return skip("next_game_not_scheduled") unless next_game.status == "scheduled"

        slot = @game.next_game_slot
        target_team = slot == "home" ? next_game.home_team : next_game.away_team
        opposite_team_id = slot == "home" ? next_game.away_team_id : next_game.home_team_id

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
