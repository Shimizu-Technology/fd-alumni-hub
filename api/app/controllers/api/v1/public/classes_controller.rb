module Api
  module V1
    module Public
      class ClassesController < BaseController
        def show
          class_key = ClassArchive::Resolver.class_key(params[:class_key].to_s.tr("-", "/"))
          return render_not_found("Class archive not found") if class_key.blank?

          archive = class_archive_for(class_key)
          return render_not_found("Class archive not found") unless archive

          teams = archive.fetch(:teams)
          title_records = archive.fetch(:title_records)
          related_records = archive.fetch(:related_records)
          games = games_for(teams)
          articles = articles_for(games, title_records, related_records)
          standings = Standing.includes(team: [ :division_record, :tournament ]).where(team_id: teams.map(&:id))
            .order(updated_at: :desc, id: :desc)

          render json: {
            classProfile: class_profile_json(class_key, archive, teams, title_records),
            titleRecords: title_records.map(&:api_json),
            relatedTitleRecords: related_records.map(&:api_json),
            teams: teams.map { |team| team.api_json(include_roster: true) },
            standings: standings.map(&:api_json),
            games: games.map { |game| game.api_json(include_rosters: true) },
            articles: articles.map(&:api_json)
          }
        end

        private

        def class_archive_for(class_key)
          component_keys = class_key.split("/").reject(&:blank?)
          return nil if component_keys.empty?

          if component_keys.one?
            individual_class_archive(component_keys.first)
          else
            combined_class_archive(class_key, component_keys)
          end
        end

        def individual_class_archive(class_key)
          cohort = ClassCohort.find_by(key: class_key)
          return nil unless cohort

          title_records = TournamentChampion.completed
            .joins(:tournament_champion_credits)
            .where(tournament_champion_credits: { class_cohort_id: cohort.id })
            .includes(tournament_champion_credits: :class_cohort)
            .distinct
            .ordered
          teams = cohort.teams.includes(:tournament, :division_record, :roster_entries, :team_class_memberships, :class_cohorts)
            .sort_by { |team| [ -team.tournament.year, team.display_name ] }

          {
            cohort: cohort,
            component_cohorts: [ cohort ],
            teams: teams,
            title_records: title_records,
            related_records: title_records.select { |record| record.champion_components.length > 1 }
          }
        end

        def combined_class_archive(class_key, component_keys)
          cohorts = ClassCohort.where(key: component_keys).to_a.sort_by { |cohort| component_keys.index(cohort.key) || component_keys.length }
          return nil unless cohorts.length == component_keys.length

          teams = teams_matching_all_cohorts(cohorts)
          title_records = TournamentChampion.completed.with_champion_key.where(champion_key: class_key).includes(tournament_champion_credits: :class_cohort).ordered
          related_records = TournamentChampion.completed
            .joins(:tournament_champion_credits)
            .where(tournament_champion_credits: { class_cohort_id: cohorts.map(&:id) })
            .where.not(champion_key: class_key)
            .includes(tournament_champion_credits: :class_cohort)
            .distinct
            .ordered

          {
            cohort: nil,
            component_cohorts: cohorts,
            teams: teams,
            title_records: title_records,
            related_records: related_records
          }
        end

        def teams_matching_all_cohorts(cohorts)
          cohort_ids = cohorts.map(&:id)
          team_ids = Team.joins(:team_class_memberships)
            .where(team_class_memberships: { class_cohort_id: cohort_ids })
            .group("teams.id")
            .having("COUNT(DISTINCT team_class_memberships.class_cohort_id) = ?", cohort_ids.length)
            .pluck(:id)

          Team.includes(:tournament, :division_record, :roster_entries, :team_class_memberships, :class_cohorts)
            .where(id: team_ids)
            .to_a
            .sort_by { |team| [ -team.tournament.year, team.display_name ] }
        end

        def games_for(teams)
          team_ids = teams.map(&:id)
          return Game.none if team_ids.empty?

          Game.includes(:division_record, { home_team: [ :division_record, :roster_entries, :team_class_memberships, :class_cohorts ] }, { away_team: [ :division_record, :roster_entries, :team_class_memberships, :class_cohorts ] })
            .where("home_team_id IN (:team_ids) OR away_team_id IN (:team_ids)", team_ids: team_ids)
            .order(start_time: :desc, id: :desc)
        end

        def articles_for(games, title_records, related_records)
          game_ids = games.map(&:id)
          tournament_ids = (title_records.map(&:tournament_id) + related_records.map(&:tournament_id)).compact.uniq
          return ArticleLink.none unless game_ids.any? || tournament_ids.any?

          scope = ArticleLink.includes(game: [ :division_record, { home_team: :division_record, away_team: :division_record } ])
          scope.where(game_id: game_ids).or(scope.where(tournament_id: tournament_ids)).latest.limit(30)
        end

        def class_profile_json(class_key, archive, teams, title_records)
          latest_team = teams.first
          cohort = archive.fetch(:cohort)
          display_name = cohort&.display_name || class_display_label(class_key)

          {
            classKey: class_key,
            routeKey: TournamentChampion.route_key(class_key),
            displayName: display_name,
            titleCount: title_records.length,
            titleYears: title_records.map(&:year).uniq.sort.reverse,
            teamCount: teams.length,
            latestTournamentYear: latest_team&.tournament&.year,
            componentClasses: archive.fetch(:component_cohorts).map(&:api_json)
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
