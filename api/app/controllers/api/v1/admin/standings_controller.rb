module Api
  module V1
    module Admin
      class StandingsController < BaseController
        def index
          tournament = admin_tournament
          standings = tournament ? standings_scope(tournament) : Standing.none
          coverage_bundle = Standings::Coverage.by_division(tournament)

          render json: {
            tournament: tournament&.api_json,
            standings: standings.map(&:api_json),
            divisionStandings: division_standings_payload(tournament, coverage_bundle),
            scoreCoverage: coverage_bundle[:overall]
          }
        end

        def recompute
          tournament = admin_tournament
          return render json: { error: "No tournament found" }, status: :not_found unless tournament

          result = Standings::Recompute.call(tournament)
          tournament.standings.reset
          coverage_bundle = Standings::Coverage.by_division(tournament)

          render json: {
            tournament: tournament.api_json,
            recompute: { teams: result.teams, games: result.games },
            standings: standings_scope(tournament).map(&:api_json),
            divisionStandings: division_standings_payload(tournament, coverage_bundle),
            scoreCoverage: coverage_bundle[:overall]
          }
        end

        private

        def standings_scope(tournament)
          scope = tournament.standings.ranked
          if params[:divisionId].present?
            scope = scope.where(team_id: tournament.teams.where(division_id: params[:divisionId]).select(:id))
          elsif params[:division].present?
            division = tournament.divisions.where("lower(name) = ? OR lower(slug) = ?", params[:division].downcase, params[:division].downcase).first
            team_ids = division ? tournament.teams.where(division_id: division.id).select(:id) : tournament.teams.where(division: params[:division]).select(:id)
            scope = scope.where(team_id: team_ids)
          end
          scope
        end

        def division_standings_payload(tournament, coverage_bundle)
          return [] unless tournament

          divisions = tournament.divisions.standings_eligible.ordered.to_a
          standings_by_division = tournament.standings.ranked.to_a.group_by { |standing| standing.team.division_id }

          divisions.map do |division|
            {
              division: division.api_json(tournament: tournament),
              standings: (standings_by_division[division.id] || []).map(&:api_json),
              scoreCoverage: coverage_bundle[:by_division][division.id] || Standings::Coverage.empty_payload
            }
          end
        end
      end
    end
  end
end
