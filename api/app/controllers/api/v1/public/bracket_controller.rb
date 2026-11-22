module Api
  module V1
    module Public
      class BracketController < BaseController
        ROUND_LABELS = {
          "play_in" => "Play-In",
          "round_of_16" => "Round of 16",
          "quarterfinal" => "Quarterfinals",
          "semifinal" => "Semifinals",
          "final" => "Championship",
          "third_place" => "Third Place",
          "unassigned" => "Playoff Games"
        }.freeze

        ROUND_ORDER = %w[play_in round_of_16 quarterfinal semifinal final third_place unassigned].freeze

        def show
          tournament = current_tournament
          return render json: { tournament: nil, divisions: [] } unless tournament

          games_scope = tournament.games
            .playoff_games
            .includes(
              :division_record,
              { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] },
              { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] }
            )
            .order(Arel.sql("bracket_slot ASC NULLS LAST, start_time ASC, id ASC"))

          if params[:divisionId].present?
            games_scope = games_scope.where(division_id: params[:divisionId])
          end

          games = games_scope.to_a
          divisions_by_id = tournament.divisions.ordered.index_by(&:id)

          grouped = games.group_by do |game|
            game.division_id || game.home_team&.division_id || game.away_team&.division_id
          end

          ordered_keys = grouped.keys.sort_by do |div_id|
            div = divisions_by_id[div_id]
            [ div ? 0 : 1, div&.position || 999, div&.name.to_s.downcase ]
          end

          division_payloads = ordered_keys.map do |div_id|
            div = divisions_by_id[div_id]
            div_games = grouped[div_id]
            rounds_grouped = div_games.group_by { |g| g.bracket_round.presence || "unassigned" }

            rounds = ROUND_ORDER.filter_map do |round_key|
              round_games = rounds_grouped[round_key]
              next unless round_games&.any?

              {
                round: round_key,
                label: ROUND_LABELS.fetch(round_key, round_key.humanize),
                games: round_games.map(&:api_json)
              }
            end

            {
              division: div ? {
                id: div.id.to_s,
                name: div.name,
                slug: div.slug,
                position: div.position
              } : {
                id: "playoffs",
                name: "Playoffs",
                slug: "playoffs",
                position: 999
              },
              rounds: rounds
            }
          end

          render json: {
            tournament: tournament.api_json,
            divisions: division_payloads
          }
        end
      end
    end
  end
end
