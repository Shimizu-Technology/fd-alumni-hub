module Api
  module V1
    module Public
      class StandingsController < BaseController
        def index
          tournament = public_schedule_tournament
          unless tournament
            return render json: {
              tournament: nil,
              standings: [],
              divisions: [],
              divisionStandings: [],
              scoreCoverage: Standings::Coverage.empty_payload
            }
          end

          eligible_divisions = tournament.divisions.standings_eligible.ordered.to_a
          selected_division = resolve_division_filter(eligible_divisions)

          filtered_divisions = if params[:divisionId].present? || params[:division].present?
            selected_division ? [ selected_division ] : []
          else
            eligible_divisions
          end

          all_standings = tournament.standings.ranked.to_a
          standings_by_division = all_standings.group_by { |standing| standing.team.division_id }
          coverage_bundle = Standings::Coverage.by_division(tournament)

          division_standings = filtered_divisions.map do |division|
            {
              division: division.api_json(tournament: tournament),
              standings: (standings_by_division[division.id] || []).map(&:api_json),
              scoreCoverage: coverage_bundle[:by_division][division.id] || Standings::Coverage.empty_payload
            }
          end

          filtered_standings = if params[:divisionId].present? || params[:division].present?
            selected_division ? (standings_by_division[selected_division.id] || []) : []
          else
            eligible_ids = eligible_divisions.map(&:id)
            eligible_ids.flat_map { |div_id| standings_by_division[div_id] || [] }
          end

          coverage = if selected_division
            coverage_bundle[:by_division][selected_division.id] || Standings::Coverage.empty_payload
          else
            coverage_bundle[:overall]
          end

          render json: {
            tournament: tournament.api_json,
            standings: filtered_standings.map(&:api_json),
            divisions: eligible_divisions.map(&:name),
            divisionStandings: division_standings,
            scoreCoverage: coverage
          }
        end

        private

        def resolve_division_filter(divisions)
          if params[:divisionId].present?
            divisions.find { |division| division.id.to_s == params[:divisionId].to_s }
          elsif params[:division].present?
            token = params[:division].to_s.strip.downcase
            divisions.find { |division| division.name.downcase == token || division.slug.downcase == token }
          end
        end
      end
    end
  end
end
