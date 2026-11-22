module Api
  module V1
    module Public
      class TeamsController < BaseController
        def index
          tournament = public_schedule_tournament
          return render json: { tournament: nil, teams: [], divisions: [], schedulePublished: false } unless tournament

          teams = tournament.teams.includes(:tournament, :division_record, team_class_memberships: :class_cohort).order(:display_name, :id)
          divisions = teams.map(&:resolved_division).compact.uniq.sort
          division = params[:division].to_s.strip
          search = params[:q].to_s.strip.downcase
          teams = teams.select { |team| team.resolved_division.to_s.casecmp?(division) } if division.present?
          teams = teams.select { |team| team.display_name.downcase.include?(search) || team.class_year_label.to_s.downcase.include?(search) } if search.present?

          render json: { tournament: tournament.api_json, teams: teams.map(&:api_json), divisions: divisions, schedulePublished: true }
        end

        def show
          team = Team.includes(:tournament, :division_record, :roster_entries, team_class_memberships: :class_cohort).find_by(id: params[:id])
          return render_not_found("Team not found") unless team&.tournament&.publicly_visible_schedule?

          games = team_games(team)
          standing = Standing.includes(team: [ :division_record, { team_class_memberships: :class_cohort } ]).find_by(team_id: team.id, tournament_id: team.tournament_id)
          articles = ArticleLink.includes(game: [ :division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ])
            .where(game_id: games.map(&:id))
            .latest
            .limit(20)
          title_records = TournamentChampion.for_team(team)

          render json: {
            tournament: team.tournament.api_json,
            team: team.api_json(include_roster: true),
            standing: standing&.api_json,
            games: games.map { |game| game.api_json(include_rosters: true) },
            articles: articles.map(&:api_json),
            titleRecords: title_records.map(&:api_json)
          }
        end

        private

        def team_games(team)
          Game
            .includes(:division_record, home_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ])
            .where(tournament_id: team.tournament_id)
            .where("home_team_id = :team_id OR away_team_id = :team_id", team_id: team.id)
            .ordered
            .to_a
        end
      end
    end
  end
end
