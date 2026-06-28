module Api
  module V1
    module Public
      class ClassesController < BaseController
        def show
          class_key = TournamentChampion.canonical_key_from_route(params[:class_key])
          return render_not_found("Class archive not found") if class_key.blank?

          teams = matching_teams(class_key)
          games = games_for(teams)
          title_records = TournamentChampion.completed.with_champion_key.where(champion_key: class_key).ordered
          related_records = related_combined_records(class_key)
          articles = articles_for(games, title_records, related_records)
          standings = Standing.includes(team: [ :division_record, :tournament ]).where(team_id: teams.map(&:id))
            .order(updated_at: :desc, id: :desc)

          render json: {
            classProfile: class_profile_json(class_key, teams, title_records),
            titleRecords: title_records.map(&:api_json),
            relatedTitleRecords: related_records.map(&:api_json),
            teams: teams.map { |team| team.api_json(include_roster: true) },
            standings: standings.map(&:api_json),
            games: games.map { |game| game.api_json(include_rosters: true) },
            articles: articles.map(&:api_json)
          }
        end

        private

        def matching_teams(class_key)
          Team.includes(:tournament, :division_record, :roster_entries).to_a.select do |team|
            [ team.display_name, team.class_year_label ].any? do |value|
              TournamentChampion.canonical_key(value) == class_key
            end
          end.sort_by { |team| [ -team.tournament.year, team.display_name ] }
        end

        def games_for(teams)
          team_ids = teams.map(&:id)
          return Game.none if team_ids.empty?

          Game.includes(:division_record, { home_team: [ :division_record, :roster_entries ] }, { away_team: [ :division_record, :roster_entries ] })
            .where("home_team_id IN (:team_ids) OR away_team_id IN (:team_ids)", team_ids: team_ids)
            .order(start_time: :desc, id: :desc)
        end

        def related_combined_records(class_key)
          TournamentChampion.completed.with_champion_key.ordered.select do |record|
            record.champion_key != class_key && record.champion_components.include?(class_key)
          end
        end

        def articles_for(games, title_records, related_records)
          game_ids = games.map(&:id)
          tournament_ids = (title_records.map(&:tournament_id) + related_records.map(&:tournament_id)).compact.uniq
          scope = ArticleLink.includes(game: [ :division_record, { home_team: :division_record, away_team: :division_record } ])
          scope = scope.where(game_id: game_ids).or(scope.where(tournament_id: tournament_ids)) if game_ids.any? || tournament_ids.any?
          return ArticleLink.none unless game_ids.any? || tournament_ids.any?

          scope.latest.limit(30)
        end

        def class_profile_json(class_key, teams, title_records)
          latest_team = teams.first
          title_labels = title_records.map(&:champion_label).reject(&:blank?)
          display_name = title_labels.first || latest_team&.display_name || class_display_label(class_key)

          {
            classKey: class_key,
            routeKey: TournamentChampion.route_key(class_key),
            displayName: display_name,
            titleCount: title_records.length,
            titleYears: title_records.map(&:year).uniq.sort.reverse,
            teamCount: teams.length,
            latestTournamentYear: latest_team&.tournament&.year
          }
        end

        def class_display_label(class_key)
          segments = class_key.split("/").map.with_index { |segment, index| class_segment_label(segment, index) }
          "Class of #{segments.join('/')}"
        end

        def class_segment_label(segment, index)
          return segment.upcase unless segment.match?(/\A\d{2}\z/)
          return segment if index.positive?

          "#{segment.to_i >= 50 ? '19' : '20'}#{segment}"
        end
      end
    end
  end
end
