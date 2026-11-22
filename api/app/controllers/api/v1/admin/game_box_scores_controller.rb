module Api
  module V1
    module Admin
      class GameBoxScoresController < BaseController
        CAPABILITY = "scores_and_stats"
        class InvalidBoxScore < StandardError; end

        def show
          game = Game.find(params[:id])
          return unless authorize_tournament!(CAPABILITY, "view", game.tournament_id)

          render json: payload(game)
        end

        def update
          game = Game.find(params[:id])
          result = Game.transaction do
            tournament = Tournament.lock.find(game.tournament_id)
            game.lock!
            game.tournament = tournament

            next unless authorize_write(game)
            unless tournament.enable_player_stats? && game.status == "final" && !game.result_placeholder?
              raise InvalidBoxScore, "Enable player stats and save a final result for this matchup first."
            end

            validate_payload!
            Audit::Context.with(actor: current_user) do
              save_entries!(game)
              publish = params[:status] == "published"
              validate_publication!(game) if publish

              game.update!(
                box_score_status: params[:status], box_score_coverage: params[:coverage],
                box_score_published_at: (Time.current if publish), box_score_updated_by: current_user
              )
            end
            payload(game)
          end
          render json: result if result
        rescue InvalidBoxScore => e
          render json: { errors: [ e.message ] }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render_errors(e.record)
        end

        private

        def authorize_write(game)
          if params[:status] == "draft" && %w[none draft].include?(game.box_score_status)
            return true if access_policy.allows?(CAPABILITY, "publish_stats", scope_type: "tournament", scope_id: game.tournament_id)

            authorize_tournament!(CAPABILITY, "edit", game.tournament_id)
          else
            authorize_tournament!(CAPABILITY, "publish_stats", game.tournament_id)
          end
        end

        def validate_payload!
          raise InvalidBoxScore, "Choose draft or published status." unless %w[draft published].include?(params[:status])
          raise InvalidBoxScore, "Choose a box score coverage type." unless Game::BOX_SCORE_COVERAGES.include?(params[:coverage])
          unless params[:entries].is_a?(Array) && params[:entries].all? { |row| row.is_a?(ActionController::Parameters) }
            raise InvalidBoxScore, "Entries must be an array of player stats."
          end
        end

        def save_entries!(game)
          entries = {}
          params[:entries].each do |row|
            id = row[:rosterEntryId]
            unless (id.is_a?(String) || id.is_a?(Integer)) && id.to_s.match?(/\A[1-9]\d{0,18}\z/) && !entries.key?(id.to_s)
              raise InvalidBoxScore, "Each player must have a valid, unique roster entry ID."
            end
            entries[id.to_s] = row
          end

          existing = game.player_game_stats.index_by { |stat| stat.roster_entry_id.to_s }
          roster = RosterEntry.where(id: entries.keys, team_id: [ game.home_team_id, game.away_team_id ])
            .includes(:team).order(:id).lock.index_by { |entry| entry.id.to_s }

          entries.each do |id, row|
            player = roster[id]
            stat = existing[id]
            unless [ nil, false, true ].include?(row[:remove])
              raise InvalidBoxScore, "Remove must be true or false."
            end
            if row[:remove]
              stat&.destroy!
              next
            end
            raise InvalidBoxScore, "Player must be on a participating roster." unless player

            attrs = stat_attributes(row)
            if attrs.values.all?(&:nil?)
              stat&.destroy!
              next
            end

            unless stat || player.active?
              raise InvalidBoxScore, "Player must be active when first recorded."
            end

            stat ||= game.player_game_stats.build(roster_entry: player, team: player.team)
            stat.update!(attrs)
          end
        end

        def stat_attributes(row)
          attrs = PlayerGameStat::METRIC_LIMITS.keys.index_with do |metric|
            value = row[metric.to_s.camelize(:lower)]
            next if value.nil? || (value.is_a?(String) && value.strip.empty?)
            next value if value.is_a?(Integer) || (value.is_a?(String) && value.strip.match?(/\A[+-]?\d+\z/))

            raise InvalidBoxScore, "#{metric.to_s.humanize} must be a whole number."
          end
          notes = row[:notes]
          raise InvalidBoxScore, "Notes must be text." unless notes.nil? || notes.is_a?(String)

          attrs.merge(notes: notes&.strip.presence)
        end

        def validate_publication!(game)
          stats = game.player_game_stats.reload
          has_metrics = stats.any? { |stat| PlayerGameStat::METRIC_LIMITS.keys.any? { |metric| !stat.public_send(metric).nil? } }
          raise InvalidBoxScore, "Enter at least one player stat line before publishing." unless has_metrics
          if stats.any? { |stat| ![ game.home_team_id, game.away_team_id ].include?(stat.team_id) }
            raise InvalidBoxScore, "Remove player stats from non-participating teams before publishing."
          end

          discrepancies = BoxScores::Discrepancies.call(game, coverage: params[:coverage], stats: stats)
          raise InvalidBoxScore, discrepancies[:warnings].join(" ") if discrepancies[:hasDiscrepancy]
        end

        def payload(game)
          stats = game.player_game_stats.order(:id).to_a
          roster = RosterEntry.where(team_id: [ game.home_team_id, game.away_team_id ])
          roster_by_team = roster.active.or(roster.where(id: stats.map(&:roster_entry_id))).ordered.group_by(&:team_id)
          {
            game: game.api_json(include_score_audit: true),
            enablePlayerStats: game.tournament.enable_player_stats?,
            boxScoreStatus: game.box_score_status,
            boxScoreCoverage: game.box_score_coverage,
            boxScorePublishedAt: game.box_score_published_at&.iso8601,
            homeRoster: roster_by_team.fetch(game.home_team_id, []).map(&:api_json),
            awayRoster: roster_by_team.fetch(game.away_team_id, []).map(&:api_json),
            stats: stats.map(&:admin_json),
            discrepancies: BoxScores::Discrepancies.call(game, stats: stats)
          }
        end
      end
    end
  end
end
