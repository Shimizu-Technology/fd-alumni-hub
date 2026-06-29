module Api
  module V1
    module Public
      class TeamsController < BaseController
        def show
          team = Team.includes(:tournament, :division_record, :roster_entries, team_class_memberships: :class_cohort).find_by(id: params[:id])
          return render_not_found("Team not found") unless team

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
