require "digest"

module Api
  module V1
    module Admin
      class GamesController < BaseController
        BRACKET_FIELDS = %i[bracket_code bracket_round bracket_slot next_game_id next_game_slot].freeze

        SCOREKEEPER_ALLOWED_TOURNAMENT_STATUSES = %w[live upcoming].freeze


        def index
          games = games_with_associations.ordered
          ids = %w[schedule_and_teams scores_and_stats tonights_menu_and_news history_and_media].flat_map do |capability|
            access_policy.scope_ids("tournament", capability: capability, action: "view")
          end.uniq
          return render_forbidden if ids.empty? && !current_user.can_score_games?
          id = params[:tournamentId].presence || params[:tournament_id].presence
          return render_forbidden if id && !ids.include?(id.to_i)

          games = games.where(tournament_id: id || ids)
          games = games.where(division: params[:division]) if params[:division].present?
          games = games.where(division_id: params[:divisionId]) if params[:divisionId].present?
          games = games.where(phase: params[:phase]) if params[:phase].present?

          render json: { games: games.limit(500).map { |g| g.api_json(include_score_audit: true) } }
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
          game = Game.new(attrs)
          return unless authorize_game_changes(game, attrs)
          saved = with_bracket_lock_if_needed(game.tournament, attrs) { game.save }

          if saved
            render json: { game: games_with_associations.find(game.id).api_json(include_score_audit: true) }, status: :created
          else
            render_errors(game)
          end
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A game with that game number or bracket feeder slot already exists." ] }, status: :unprocessable_entity
        end

        def update
          game = Game.find(params[:id])
          incoming = game_params.except(:tournament_id)
          return unless authorize_game_changes(game, incoming)
          if (incoming.keys - BRACKET_FIELDS - [ :lock_version ]).any? || (incoming.keys & BRACKET_FIELDS).empty?
            return unless authorize_tournament!("schedule_and_teams", "edit", game.tournament_id)
          end
          lock_version_present = incoming.key?(:lock_version)
          lock_version_param = incoming.delete(:lock_version)

          if lock_version_present && !lock_version_param.nil? && lock_version_param.to_s.strip != ""
            parsed_version = parse_lock_version(lock_version_param)
            return render json: { errors: [ "lockVersion must be a non-negative integer" ] }, status: :unprocessable_entity unless parsed_version

            game.lock_version = parsed_version
          end

          standings_sensitive = standings_sensitive_change?(incoming)
          saved = with_bracket_lock_if_needed(game.tournament, incoming) { game.update(incoming) }

          if saved
            recompute = standings_sensitive ? Standings::Recompute.call(game.tournament) : nil
            advancement = advance_bracket_winner_safely(game)
            render json: {
              game: games_with_associations.find(game.id).api_json(include_score_audit: true),
              recompute: recompute && { teams: recompute.teams, games: recompute.games },
              bracketAdvancement: advancement&.api_json
            }.compact
          else
            render_errors(game)
          end
        rescue ActiveRecord::StaleObjectError
          render json: {
            error: "This game was updated by another user. Reload to review the latest values.",
            currentGame: games_with_associations.find(game.id).api_json(include_score_audit: true)
          }, status: :conflict
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A game with that game number or bracket feeder slot already exists." ] }, status: :unprocessable_entity
        end

        def score
          game = Game.includes(:tournament).find(params[:id])
          return unless authorize_tournament!("scores_and_stats", "edit", game.tournament_id)
          incoming = score_params
          client_mutation_id = incoming[:client_mutation_id].to_s.strip.presence
          force_overwrite = ActiveModel::Type::Boolean.new.cast(incoming[:force_overwrite]) == true

          if client_mutation_id.present? && !client_mutation_id.match?(Game::MUTATION_ID_FORMAT)
            return render json: { errors: [ "clientMutationId must be 8-64 alphanumeric, dash, or underscore characters" ] }, status: :unprocessable_entity
          end

          next_home_score = incoming.key?(:home_score) ? parse_optional_score(incoming[:home_score]) : game.home_score
          next_away_score = incoming.key?(:away_score) ? parse_optional_score(incoming[:away_score]) : game.away_score
          if next_home_score == :invalid || next_away_score == :invalid
            return render json: { errors: [ "Scores must be whole numbers between 0 and 300" ] }, status: :unprocessable_entity
          end

          if incoming.key?(:status) && incoming[:status].to_s.strip.blank?
            return render json: { errors: [ "Status cannot be blank" ] }, status: :unprocessable_entity
          end

          next_status = incoming.key?(:status) ? incoming[:status].to_s.strip.downcase : game.status
          next_status_note = incoming.key?(:status_note) ? incoming[:status_note].to_s.strip.presence : game.status_note
          payload_digest = compute_score_digest(
            home_score: next_home_score,
            away_score: next_away_score,
            status: next_status,
            status_note: next_status_note
          )

          # Check idempotent replay BEFORE scorekeeper final-game guardrails so a dropped
          # response after finalizing safely replays as 200 OK instead of 403 Forbidden.
          if client_mutation_id.present? && game.last_score_mutation_id == client_mutation_id && replay_authorized?(game)
            return render_mutation_id_match(game, payload_digest)
          end

          unless access_policy.allows?("scores_and_stats", "correct_final", scope_type: "tournament", scope_id: game.tournament_id)
            unless SCOREKEEPER_ALLOWED_TOURNAMENT_STATUSES.include?(game.tournament&.status)
              return render_forbidden("Scorekeepers can only enter scores for live or upcoming tournaments.")
            end

            if game.status == "final"
              return render_forbidden("Finalized games can only be edited or reopened by tournament staff or admins.")
            end
          end

          if next_status == "final" && (next_home_score.nil? || next_away_score.nil?)
            return render json: { errors: [ "Both home and away scores are required to finalize a game." ] }, status: :unprocessable_entity
          end

          lock_version_param = incoming[:lock_version]
          unless force_overwrite
            if lock_version_param.nil? || lock_version_param.to_s.strip == ""
              return render json: { errors: [ "lockVersion is required unless forceOverwrite is true" ] }, status: :unprocessable_entity
            end

            parsed_version = parse_lock_version(lock_version_param)
            return render json: { errors: [ "lockVersion must be a non-negative integer" ] }, status: :unprocessable_entity unless parsed_version

            game.lock_version = parsed_version
          end

          was_final = (game.status == "final")
          game.home_score = next_home_score
          game.away_score = next_away_score
          game.status = next_status
          game.status_note = next_status_note
          game.score_updated_by = current_user
          game.score_updated_at = Time.current
          if client_mutation_id.present?
            game.last_score_mutation_id = client_mutation_id
            game.last_score_mutation_digest = payload_digest
          end

          if game.save
            should_recompute = game.pool_phase? && (was_final || game.status == "final")
            recompute = should_recompute ? Standings::Recompute.call(game.tournament) : nil
            advancement = (game.status == "final" && game.next_game_id.present?) ? advance_bracket_winner_safely(game) : nil

            render json: {
              game: games_with_associations.find(game.id).api_json(include_score_audit: true),
              idempotentReplay: false,
              recompute: recompute && { teams: recompute.teams, games: recompute.games },
              bracketAdvancement: advancement&.api_json
            }.compact
          else
            render_errors(game)
          end
        rescue ActiveRecord::StaleObjectError
          fresh = Game.find(game.id)
          if client_mutation_id.present? && fresh.last_score_mutation_id == client_mutation_id && replay_authorized?(fresh)
            return render_mutation_id_match(fresh, payload_digest)
          end

          render json: {
            error: "Score was updated by another user. Review the latest score before continuing.",
            currentGame: games_with_associations.find(fresh.id).api_json(include_score_audit: true)
          }, status: :conflict
        end

        private

        def authorize_game_changes(game, attrs)
          baseline = game.new_record? ? Game.new : game
          changes = attrs.select { |key, value| Game.type_for_attribute(key.to_s).cast(value) != baseline.public_send(key) }
          if (changes.keys & BRACKET_FIELDS).any? && !authorize_tournament!("brackets", "edit", game.tournament_id)
            return false
          end

          scoring = changes.keys.intersect?(%i[home_score away_score]) || changes[:status] == "final" || (game.persisted? && game.status == "final" && changes.key?(:status))
          return true unless scoring

          action = game.persisted? && game.status == "final" ? "correct_final" : "edit"
          authorize_tournament!("scores_and_stats", action, game.tournament_id)
        end

        def replay_authorized?(game)
          current_user.staff? || game.score_updated_by_id == current_user.id
        end

        def render_mutation_id_match(game, payload_digest)
          serialized = games_with_associations.find(game.id).api_json(include_score_audit: true)
          if game.last_score_mutation_digest == payload_digest
            render json: { game: serialized, idempotentReplay: true }
          else
            render json: {
              error: "Mutation ID reused with different score payload.",
              currentGame: serialized
            }, status: :conflict
          end
        end

        def compute_score_digest(home_score:, away_score:, status:, status_note:)
          canonical = {
            awayScore: away_score,
            homeScore: home_score,
            status: status,
            statusNote: status_note
          }
          Digest::SHA256.hexdigest(canonical.to_json)
        end

        def parse_optional_score(value)
          return nil if value.nil? || value.to_s.strip == ""
          return value if value.is_a?(Integer)
          return :invalid unless value.to_s.strip.match?(/\A\d+\z/)

          value.to_s.strip.to_i
        end

        def score_params
          allowed_keys = %i[
            home_score homeScore
            away_score awayScore
            status
            status_note statusNote
            lock_version lockVersion
            force_overwrite forceOverwrite
            client_mutation_id clientMutationId
          ]

          merged = {}
          [ params[:game], params, params[:score] ].each do |source|
            next unless source.is_a?(ActionController::Parameters)

            source.permit(*allowed_keys).to_h.each do |key, value|
              merged[key.to_sym] = value
            end
          end

          attrs = {}
          assign_param(attrs, merged, :home_score, :home_score, :homeScore)
          assign_param(attrs, merged, :away_score, :away_score, :awayScore)
          assign_param(attrs, merged, :status, :status)
          assign_param(attrs, merged, :status_note, :status_note, :statusNote)
          assign_param(attrs, merged, :lock_version, :lock_version, :lockVersion)
          assign_param(attrs, merged, :force_overwrite, :force_overwrite, :forceOverwrite)
          assign_param(attrs, merged, :client_mutation_id, :client_mutation_id, :clientMutationId)
          attrs
        end

        def with_bracket_lock_if_needed(tournament, attrs)
          if tournament && (attrs.key?(:next_game_id) || attrs.key?(:next_game_slot))
            tournament.with_lock { yield }
          else
            yield
          end
        end

        def advance_bracket_winner_safely(game)
          return nil unless game.next_game_id.present?

          Games::AdvanceBracketWinner.call(game)
        rescue StandardError => e
          Rails.logger.error("Games::AdvanceBracketWinner failed for game #{game.id}: #{e.class}: #{e.message}")
          Games::AdvanceBracketWinner::Result.new(advanced: false, reason: "advancement_failed")
        end

        def parse_lock_version(value)
          return value if value.is_a?(Integer) && value >= 0
          return nil unless value.to_s.strip.match?(/\A\d+\z/)

          value.to_s.strip.to_i
        end

        def games_with_associations
          Game.includes(:division_record, :score_updated_by, home_team: :division_record, away_team: :division_record)
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
