require "digest"

module Games
  class RecordResult
    FIELDS = %i[home_score away_score status result_outcome official_winner_team_id status_note start_time].freeze
    CONTROL_FIELDS = %i[lock_version client_mutation_id force_overwrite reason].freeze
    REASON_LENGTH = 3..500
    LEGACY_DIGEST_FIELDS = { awayScore: :away_score, homeScore: :home_score, status: :status, statusNote: :status_note }.freeze

    Result = Struct.new(:status, :body, :recompute_tournament, keyword_init: true) do
      def ok?
        status == 200
      end
    end

    def self.call(game, attrs, **options)
      new(game, attrs, **options).call
    end

    def self.refresh_standings(tournaments)
      tournaments = tournaments.compact.uniq(&:id)
      return { standingsStatus: "skipped" } if tournaments.empty?

      failed = false
      counts = tournaments.filter_map do |tournament|
        result = Tournament.transaction(requires_new: true) { Standings::Recompute.call(tournament) }
        { teams: result.teams, games: result.games }
      rescue StandardError => e
        failed = true
        Rails.logger.error("Standings recompute failed for tournament #{tournament.id}: #{e.class}: #{e.message}")
        nil
      end
      summary = counts.each_with_object({ teams: 0, games: 0 }) do |row, totals|
        row.each { |key, value| totals[key] += value }
      end
      { standingsStatus: failed ? "failed" : "updated", recompute: (summary unless counts.empty?) }.compact
    end

    def initialize(game, attrs, actor: nil, policy: nil, defer_recompute: false,
                   require_reason_on_final_correction: true, interactive: true, schedule_attributes: {})
      @game = game
      @attrs = attrs
      @actor = actor
      @policy = policy || (Access::Policy.new(actor) if interactive && actor)
      @interactive = interactive
      @defer_recompute = defer_recompute
      @require_reason = require_reason_on_final_correction
      @schedule_attributes = schedule_attributes
    end

    def call
      @mutation_id = @attrs[:client_mutation_id].to_s.strip.presence
      if @mutation_id && (!@actor || !@mutation_id.match?(Game::MUTATION_ID_FORMAT))
        return invalid("clientMutationId must be 8-64 alphanumeric, dash, or underscore characters")
      end

      result = Game.transaction(requires_new: true) do
        # Schedule imports and bracket propagation use the same tournament-before-game lock order.
        @tournament = Tournament.lock.find(@game.tournament_id)
        @game.lock! if @game.persisted?
        record
      end
      result.body.merge!(self.class.refresh_standings([ result.recompute_tournament ])) if result.ok? && !@defer_recompute
      result
    rescue ActiveRecord::RecordInvalid => e
      invalid(*e.record.errors.full_messages)
    rescue ActiveRecord::StaleObjectError
      @game.reload
      replay || conflict
    rescue ActiveRecord::RecordNotUnique => e
      if e.message.include?("index_score_mutations_on_actor_game_and_client_id")
        @game.reload
        replay || conflict("Mutation ID was already submitted.")
      else
        invalid("A game with that game number or bracket feeder slot already exists.")
      end
    end

    # Normalize the submitted fields alone so a partial payload can replay after later edits.
    def submitted_fields
      @submitted_fields ||= @attrs.slice(*FIELDS).each_with_object({}) do |(key, value), fields|
        next if key == :start_time && value.blank?

        fields[key] = normalize(key, value)
      end
    end

    def proposed_attributes(game = @game)
      values = FIELDS.excluding(:start_time).index_with { |key| game.public_send(key) }.merge(submitted_fields)
      if %w[postponed cancelled].include?(values[:result_outcome]) && submitted_fields.key?(:result_outcome)
        values[:status] = values[:result_outcome]
      end
      if %w[postponed cancelled].include?(values[:status])
        values.merge!(result_outcome: values[:status], home_score: nil, away_score: nil, official_winner_team_id: nil)
      elsif values[:status] != "final" && values[:result_outcome] == game.result_outcome && !submitted_fields.key?(:result_outcome)
        values.merge!(result_outcome: nil, official_winner_team_id: nil)
      elsif %w[postponed cancelled].include?(values[:result_outcome]) && !submitted_fields.key?(:result_outcome)
        values[:result_outcome] = nil
      end
      if values[:result_outcome] != "forfeit" && !submitted_fields.key?(:official_winner_team_id)
        scores_submitted = submitted_fields.key?(:home_score) || submitted_fields.key?(:away_score)
        unequal_scores = values[:home_score].is_a?(Integer) && values[:away_score].is_a?(Integer) &&
          values[:home_score] != values[:away_score]
        values[:official_winner_team_id] = nil if scores_submitted || unequal_scores
      end
      values
    end

    def validation_errors(game, values)
      errors = []
      errors << "Scores must be whole numbers between 0 and 300" if %i[home_score away_score].any? do |key|
        [ submitted_fields[key], values[key] ].compact.any? { |score| !score.is_a?(Integer) || !(0..300).cover?(score) }
      end
      errors << "Status is invalid" unless Game::STATUSES.include?(values[:status]) &&
        (!submitted_fields.key?(:status) || Game::STATUSES.include?(submitted_fields[:status]))
      if submitted_fields[:result_outcome] && !Game::RESULT_OUTCOMES.include?(submitted_fields[:result_outcome])
        errors << "Game outcome is invalid"
      end
      if game.result_placeholder? && (values[:status] == "final" || values[:home_score] || values[:away_score])
        errors << "Assign teams before entering a result for a placeholder matchup."
      end
      submitted_winner = submitted_fields[:official_winner_team_id]
      if [ values[:official_winner_team_id], submitted_winner ].compact.any? { |id| ![ game.home_team_id, game.away_team_id ].include?(id) }
        errors << "Official winner must be the home or away team"
      end
      errors << "Public note is invalid" if values[:status_note] == :invalid
      errors << "Public note is too long (maximum is 240 characters)" if values[:status_note].to_s.length > 240
      errors << "Start time is invalid" if values[:start_time] == :invalid
      if values.key?(:start_time) && !%w[postponed cancelled].include?(values[:status])
        errors << "A rescheduled time requires a postponed or cancelled game."
      end
      if values[:status] != "final"
        errors << "A forfeit must be marked final." if values[:result_outcome] == "forfeit"
        return errors
      end

      home, away, winner = values.values_at(:home_score, :away_score, :official_winner_team_id)
      if values[:result_outcome] == "forfeit"
        errors << "Choose an official winner for the forfeit." if winner.nil?
        errors << "Enter both official scores or leave both blank." if home.nil? != away.nil?
      elsif home.nil? || away.nil?
        errors << "Both home and away scores are required to finalize a game."
      elsif (game.playoff_phase? || game.next_game_id.present?) && home == away && winner.nil?
        errors << "Choose an official winner for a tied playoff game."
      elsif winner.present? && home.is_a?(Integer) && away.is_a?(Integer) && home != away
        expected_winner = home > away ? game.home_team_id : game.away_team_id
        if winner != expected_winner
          errors << "Official winner must match the higher score unless recorded as a forfeit."
        end
      end
      errors
    end

    private

    def record
      if @interactive && !%w[edit correct_final].any? { |action| allowed?(action) }
        return forbidden("This action is outside your workspace access.")
      end

      previous_replay = replay
      return previous_replay if previous_replay

      was_final = @game.status == "final" && @game.persisted?
      correct_final = allowed?("correct_final")
      can_edit = allowed?("edit")
      if @interactive && !(correct_final || can_edit)
        return forbidden("This action is outside your workspace access.")
      end
      if @interactive && !correct_final && !%w[live upcoming].include?(@tournament.status)
        return forbidden("Scorekeepers can only enter scores for live or upcoming tournaments.")
      end

      reason = @attrs[:reason].strip.presence if @attrs[:reason].is_a?(String)
      valid_reason = reason && REASON_LENGTH.cover?(reason.length)
      force = ActiveModel::Type::Boolean.new.cast(@attrs[:force_overwrite])
      return forbidden("Force overwrite requires final correction access and a reason.") if force && !(correct_final && valid_reason)

      if @interactive && @game.persisted? && !force
        version = normalize_integer(@attrs[:lock_version])
        return invalid("lockVersion is required") if version.nil?
        return invalid("lockVersion must be a non-negative integer") unless version.is_a?(Integer)
        return conflict unless @game.lock_version == version
      end
      if @interactive
        return forbidden("Finalized games can only be edited or reopened by tournament staff or admins.") if was_final && !correct_final
        return forbidden("This action is outside your workspace access.") if !was_final && !can_edit
      end
      if @require_reason && (was_final || @attrs[:reason].present?) && !valid_reason
        return invalid("A correction reason between 3 and 500 characters is required.")
      end

      previously_pool = @game.pool_phase?
      previous_winner = @game.winner_team_id
      @game.assign_attributes(@schedule_attributes)
      values = proposed_attributes
      errors = validation_errors(@game, values)
      return invalid(*errors) if errors.any?

      @game.assign_attributes(values)
      result_changed = (FIELDS & @game.changes.keys.map(&:to_sym)).any?
      recompute = (previously_pool || @game.pool_phase?) && (was_final || @game.status == "final" || @defer_recompute) && @game.changed?
      if result_changed
        @game.score_updated_by = @actor if @actor
        @game.score_updated_at = Time.current
        # The legacy marker is meaningful only for the recorded actor and payload.
        @game.last_score_mutation_id = nil
        @game.last_score_mutation_digest = nil
      end

      action = if result_changed
        was_final ? "score_corrected" : "score_recorded"
      end
      Audit::Context.with(actor: (@actor unless Audit::Context.values&.dig(:actor_id)), reason: reason, action_override: action) { @game.save! }

      advancement = if @game.next_game_id && (previous_winner || @game.status == "final" || was_final)
        advance_bracket_safely(previous_winner: previous_winner, reopened: was_final && @game.status != "final")
      end
      game_json = serialize_game
      if @mutation_id
        ScoreMutation.create!(actor: @actor, game: @game, client_mutation_id: @mutation_id,
          payload_digest: payload_digest, result_snapshot: game_json)
      end
      Result.new(status: 200, body: {
        game: game_json, idempotentReplay: false, bracketAdvancement: advancement&.api_json
      }.compact, recompute_tournament: (@tournament if recompute))
    end

    def advance_bracket_safely(previous_winner:, reopened:)
      Game.transaction(requires_new: true) do
        Games::AdvanceBracketWinner.call(@game, previous_winner_id: previous_winner, reopened: reopened)
      end
    rescue StandardError => e
      Rails.logger.error("Games::AdvanceBracketWinner failed for game #{@game.id}: #{e.class}: #{e.message}")
      note = "Automatic bracket advancement failed — review downstream matchup."
      Audit::Context.with(actor: (@actor unless Audit::Context.values&.dig(:actor_id))) do
        @game.update!(bracket_needs_review: true, bracket_exception_note: note)
      end
      Games::AdvanceBracketWinner::Result.new(
        advanced: false,
        reason: "advancement_failed",
        needs_review: true,
        next_game_id: @game.next_game_id,
        slot: @game.next_game_slot
      )
    end

    def replay
      return unless @mutation_id && @game.persisted?

      saved = ScoreMutation.find_by(actor_id: @actor.id, game_id: @game.id, client_mutation_id: @mutation_id)
      if saved
        matches = saved.payload_digest == payload_digest
      elsif @game.last_score_mutation_id == @mutation_id && @game.score_updated_by_id == @actor.id
        values = proposed_attributes
        legacy = LEGACY_DIGEST_FIELDS.transform_values { |key| values[key] }
        matches = submitted_fields.except(*LEGACY_DIGEST_FIELDS.values).values.all?(&:nil?) &&
          @game.last_score_mutation_digest == Digest::SHA256.hexdigest(legacy.to_json)
        if matches
          ScoreMutation.create!(actor: @actor, game: @game, client_mutation_id: @mutation_id,
            payload_digest: payload_digest, result_snapshot: serialize_game)
        end
      else
        return
      end
      return conflict("Mutation ID reused with different score payload.") unless matches

      Result.new(
        status: 200,
        body: { game: serialize_game, idempotentReplay: true },
        recompute_tournament: (@tournament if @game.pool_phase? && @game.status == "final")
      )
    end

    def payload_digest
      Digest::SHA256.hexdigest({
        result: submitted_fields.sort.to_h, reason: @attrs[:reason].to_s.strip.presence,
        schedule: @schedule_attributes.sort.to_h
      }.to_json)
    end

    def normalize(key, value)
      return :invalid if value == :invalid

      case key
      when :home_score, :away_score, :official_winner_team_id then normalize_integer(value)
      when :start_time
        value.is_a?(String) ? Time.zone.iso8601(value).utc : :invalid
      when :status, :result_outcome then value.to_s.strip.downcase.presence
      when :status_note then value.to_s.strip.presence
      end
    rescue ArgumentError
      :invalid
    end

    def normalize_integer(value)
      return nil if value.nil? || (value.is_a?(String) && value.strip.empty?)
      return value if value.is_a?(Integer) && value >= 0
      return value.strip.to_i if value.is_a?(String) && value.strip.match?(/\A\d+\z/)

      :invalid
    end

    def allowed?(action)
      @policy&.allows?("scores_and_stats", action, scope_type: "tournament", scope_id: @game.tournament_id)
    end

    def serialize_game
      @game.api_json(include_score_audit: true)
    end

    def invalid(*errors)
      Result.new(status: 422, body: { errors: errors })
    end

    def forbidden(error)
      Result.new(status: 403, body: { error: error })
    end

    def conflict(error = "Score was updated by another user. Review the latest score before continuing.")
      Result.new(status: 409, body: { error: error, currentGame: serialize_game })
    end
  end
end
