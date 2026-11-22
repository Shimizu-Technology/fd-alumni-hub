module Api
  module V1
    module Admin
      class GamesController < BaseController
        BRACKET_FIELDS = %i[bracket_code bracket_round bracket_slot next_game_id next_game_slot].freeze

        include ResultParameters

        def index
          games = games_with_associations.ordered
          ids = %w[schedule_and_teams scores_and_stats tonights_menu_and_news history_and_media].flat_map do |capability|
            access_policy.scope_ids("tournament", capability: capability, action: "view")
          end.uniq
          return render_forbidden if ids.empty?
          id = params[:tournamentId].presence || params[:tournament_id].presence
          return render_forbidden if id && !ids.include?(id.to_i)

          games = games.where(tournament_id: id || ids)
          games = games.where(division: params[:division]) if params[:division].present?
          games = games.where(division_id: params[:divisionId]) if params[:divisionId].present?
          games = games.where(phase: params[:phase]) if params[:phase].present?

          day = requested_day
          schedule = Game.where(tournament_id: id || ids)
          available_dates = schedule.distinct.pluck(Arel.sql("date(start_time AT TIME ZONE 'UTC' AT TIME ZONE 'Pacific/Guam')")).sort
          next_date = if day
            schedule.where(status: Game::ACTIVE_STATUSES).where(start_time: day.next_day.beginning_of_day..)
              .minimum(:start_time)&.in_time_zone&.to_date
          end
          games = games.where(start_time: day.all_day) if day
          games = games.where(status: Game::ACTIVE_STATUSES) if params[:unscoredOnly] == "true"

          render json: {
            games: games.limit(500).map { |game| game.api_json(include_score_audit: true) },
            requestedDate: day&.iso8601, nextScheduledDate: next_date&.iso8601,
            availableDates: available_dates, pendingCorrectionCount: pending_correction_count(id)
          }
        rescue Date::Error
          render json: { errors: [ "date must be a valid YYYY-MM-DD" ] }, status: :unprocessable_entity
        end

        def show
          game = games_with_associations.find(params[:id])
          return render_forbidden unless %w[schedule_and_teams scores_and_stats].any? do |capability|
            access_policy.allows?(capability, "view", scope_type: "tournament", scope_id: game.tournament_id)
          end
          render json: { game: game.api_json(include_score_audit: true) }
        end

        def create
          attrs = game_params.except(:lock_version)
          return unless authorize_tournament!("schedule_and_teams", "edit", attrs[:tournament_id])

          result = result_params(params, params[:game]).except(:start_time)
          game = Game.new(attrs)
          return unless authorize_bracket_changes(game, attrs, attrs[:tournament_id])

          normalized_status = result[:status].to_s.strip.downcase
          if result.keys.intersect?(%i[home_score away_score result_outcome official_winner_team_id]) || %w[final postponed cancelled].include?(normalized_status)
            game = Game.new(attrs.except(*result.keys))
            response = record_result(game, result)
            render json: response.body, status: response.ok? ? :created : response.status
          elsif with_bracket_lock_if_needed(game.tournament, attrs) { game.save }
            render json: { game: game.api_json(include_score_audit: true) }, status: :created
          else
            render_errors(game)
          end
        rescue ActiveRecord::RecordNotUnique
          render_duplicate_game
        end

        def update
          game = Game.find(params[:id])
          incoming = game_params.except(:tournament_id, :lock_version)
          result = result_params(params, params[:game])
          changed_results = result.slice(*Games::RecordResult::FIELDS.excluding(:start_time)).any? do |key, value|
            value != game.public_send(key) && (value != game.public_send(key).to_s || value == "")
          end
          result_write = changed_results || result[:client_mutation_id].present?
          schedule = incoming.except(*Games::RecordResult::FIELDS.excluding(:start_time), *Games::RecordResult::CONTROL_FIELDS)
          return unless authorize_bracket_changes(game, schedule, game.tournament_id)
          if (schedule.keys - BRACKET_FIELDS).any? || (!result_write && schedule.empty?)
            return unless authorize_tournament!("schedule_and_teams", "edit", game.tournament_id)
          end

          if result_write
            result = result.except(:start_time)
            response = record_result(game, result, schedule_attributes: schedule)
            return render json: response.body, status: response.status
          end

          version = result[:lock_version]
          if version.present?
            unless version.to_s.match?(/\A\d+\z/)
              return render json: { errors: [ "lockVersion must be a non-negative integer" ] }, status: :unprocessable_entity
            end
            game.lock_version = version.to_i
          end
          team_changed = (schedule.key?(:home_team_id) && schedule[:home_team_id].to_i != game.home_team_id) ||
            (schedule.key?(:away_team_id) && schedule[:away_team_id].to_i != game.away_team_id)
          if team_changed && game.box_score_status == "published"
            schedule = schedule.merge(box_score_status: "needs_review")
          end
          if with_bracket_lock_if_needed(game.tournament, schedule) { game.update(schedule) }
            advancement = Games::AdvanceBracketWinner.call(game) if game.next_game_id && game.status == "final"
            standings = Games::RecordResult.refresh_standings([ game.tournament ]) if standings_sensitive_change?(schedule)
            render json: { game: game.api_json(include_score_audit: true), bracketAdvancement: advancement&.api_json }.compact.merge(standings || {})
          else
            render_errors(game)
          end
        rescue ActiveRecord::StaleObjectError
          render json: { error: "This game was updated by another user. Reload to review the latest values.",
                         currentGame: Game.find(game.id).api_json(include_score_audit: true) }, status: :conflict
        rescue ActiveRecord::RecordNotUnique
          render_duplicate_game
        end

        def score
          game = Game.find(params[:id])
          result = record_result(game, result_params(params[:game], params, params[:score]))
          render json: result.body, status: result.status
        end

        def batch_results
          rows = params[:results]
          unless rows.is_a?(Array) && rows.size.between?(1, 500)
            return render json: { errors: [ "Submit between 1 and 500 result rows." ] }, status: :unprocessable_entity
          end
          tournament_id = params[:tournamentId].presence
          tournaments = []
          results = rows.map do |row|
            id = row.is_a?(ActionController::Parameters) ? row[:gameId].presence : nil
            game = id.to_s.match?(/\A\d+\z/) && Game.find_by(id: id)
            unless game && (!tournament_id || tournament_id.to_s == game.tournament_id.to_s)
              next { gameId: id, ok: false, status: 404, error: "Game not found in this tournament." }
            end

            result = record_result(game, result_params(row), defer_recompute: true)
            tournaments << result.recompute_tournament
            { gameId: game.id.to_s, ok: result.ok?, status: result.status }.merge(result.body)
          rescue ActiveRecord::RecordNotFound
            { gameId: id, ok: false, status: 404, error: "Game not found in this tournament." }
          rescue StandardError => e
            Rails.logger.error("Batch result failed for game #{game&.id}: #{e.class}: #{e.message}")
            { gameId: id, ok: false, status: 500, error: "This result could not be saved." }
          end
          render json: { results: results, recompute: nil }.merge(Games::RecordResult.refresh_standings(tournaments))
        end

        def resolve_bracket_review
          game = Game.find(params[:id])
          return unless authorize_tournament!("brackets", "resolve_exceptions", game.tournament_id)

          note = params[:note].to_s.strip.presence
          if note && note.length > 500
            return render json: { errors: [ "Resolution note must be at most 500 characters." ] }, status: :unprocessable_entity
          end
          game.with_lock do
            Audit::Context.with(reason: note, action_override: "bracket_review_resolved") do
              game.update!(bracket_needs_review: false, bracket_exception_note: nil)
            end
          end
          render json: { game: game.api_json(include_score_audit: true) }
        end

        private

        def requested_day
          return unless params.key?(:date)
          raise Date::Error unless params[:date].is_a?(String) && params[:date].match?(/\A\d{4}-\d{2}-\d{2}\z/)

          Date.iso8601(params[:date])
        end

        def pending_correction_count(id)
          scope = ScoreCorrectionRequest.where(status: "pending")
          view_ids = access_policy.scope_ids("tournament", capability: "scores_and_stats", action: "view")
          view_ids &= [ id.to_i ] if id
          correct_ids = access_policy.scope_ids("tournament", capability: "scores_and_stats", action: "correct_final")
          scope.where(tournament_id: view_ids & correct_ids)
            .or(scope.where(tournament_id: view_ids, requested_by: current_user)).count
        end

        def record_result(game, attrs, **options)
          Games::RecordResult.call(game, attrs, actor: current_user, policy: access_policy, **options)
        end

        def authorize_bracket_changes(game, attrs, tournament_id)
          baseline = game.new_record? ? Game.new : game
          effective_bracket_change = (attrs.keys & BRACKET_FIELDS).any? do |key|
            Game.type_for_attribute(key.to_s).cast(attrs[key]) != baseline.public_send(key)
          end
          !effective_bracket_change || authorize_tournament!("brackets", "edit", tournament_id)
        end

        def with_bracket_lock_if_needed(tournament, attrs)
          if tournament && attrs.keys.intersect?(BRACKET_FIELDS)
            tournament.with_lock { yield }
          else
            yield
          end
        end

        def render_duplicate_game
          render json: { errors: [ "A game with that game number or bracket feeder slot already exists." ] }, status: :unprocessable_entity
        end

        def games_with_associations
          Game.includes(:tournament, :division_record, :score_updated_by, home_team: :division_record, away_team: :division_record)
        end

        def game_params
          raw = params.fetch(:game, params)
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :home_team_id,
            :homeTeamId,
            :away_team_id,
            :awayTeamId,
            :start_time,
            :startTime,
            :venue,
            :status,
            :status_note,
            :statusNote,
            :phase,
            :game_number,
            :gameNumber,
            :bracket_code,
            :bracketCode,
            :bracket_round,
            :bracketRound,
            :bracket_slot,
            :bracketSlot,
            :next_game_id,
            :nextGameId,
            :next_game_slot,
            :nextGameSlot,
            :home_score,
            :homeScore,
            :away_score,
            :awayScore,
            :stream_url,
            :streamUrl,
            :ticket_url,
            :ticketUrl,
            :notes,
            :division_id,
            :divisionId,
            :division,
            :lock_version,
            :lockVersion
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :home_team_id, :home_team_id, :homeTeamId)
          assign_param(attrs, permitted, :away_team_id, :away_team_id, :awayTeamId)
          assign_param(attrs, permitted, :start_time, :start_time, :startTime)
          assign_param(attrs, permitted, :venue, :venue)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :status_note, :status_note, :statusNote)
          assign_param(attrs, permitted, :phase, :phase)
          assign_param(attrs, permitted, :game_number, :game_number, :gameNumber)
          assign_param(attrs, permitted, :bracket_code, :bracket_code, :bracketCode)
          assign_param(attrs, permitted, :bracket_round, :bracket_round, :bracketRound)
          assign_param(attrs, permitted, :bracket_slot, :bracket_slot, :bracketSlot)
          assign_param(attrs, permitted, :next_game_id, :next_game_id, :nextGameId)
          assign_param(attrs, permitted, :next_game_slot, :next_game_slot, :nextGameSlot)
          assign_param(attrs, permitted, :home_score, :home_score, :homeScore)
          assign_param(attrs, permitted, :away_score, :away_score, :awayScore)
          assign_param(attrs, permitted, :stream_url, :stream_url, :streamUrl)
          assign_param(attrs, permitted, :ticket_url, :ticket_url, :ticketUrl)
          assign_param(attrs, permitted, :notes, :notes)
          assign_param(attrs, permitted, :division_id, :division_id, :divisionId)
          assign_param(attrs, permitted, :division, :division)
          assign_param(attrs, permitted, :lock_version, :lock_version, :lockVersion)
          attrs
        end

        def standings_sensitive_change?(incoming)
          incoming.key?(:status) || incoming.key?(:home_score) || incoming.key?(:away_score) ||
            incoming.key?(:home_team_id) || incoming.key?(:away_team_id) ||
            incoming.key?(:phase) || incoming.key?(:notes) || incoming.key?(:bracket_code) ||
            incoming.key?(:division_id) || incoming.key?(:division)
        end
      end
    end
  end
end
