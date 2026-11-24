module Api
  module V1
    module Public
      class HomeController < BaseController
        def show
          context = Tournament.home_context
          tournament = site_context.tournament
          payload = {
            tournament: tournament&.api_json,
            siteMode: site_context.as_json,
            championRecords: site_context.sections["recap"] ? site_context.champion_records.map(&:api_json) : [],
            upcomingOrLiveTournament: (site_context.publication ? tournament : context[:upcoming_or_live])&.api_json,
            latestResultsTournament: context[:latest_completed_with_games]&.api_json,
            activeHostCampaign: site_context.campaign&.home_summary_json,
            alerts: site_context.alerts.map(&:api_json),
            todayGames: [],
            liveGames: [],
            latestNews: [],
            gameDayNote: nil,
            predictionPolls: []
          }

          if site_context.mode == "fundraising" && site_context.campaign && site_context.sections["fundraisers"]
            payload[:hostYear] = HostCampaigns::PublicShowcase.new(site_context.campaign, mode: site_context.mode).as_json
          end

          return render json: payload unless tournament&.publicly_visible_schedule?

          today_range = Time.zone.now.beginning_of_day..Time.zone.now.end_of_day
          games_scope = tournament.games.includes(:division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] })
          today_games = games_scope.where(start_time: today_range).ordered.limit(20).to_a
          live_games = games_scope.where(status: "live").ordered.limit(10).to_a
          game_day_note = tournament.game_day_notes.active.find_by(date: Time.zone.today, status: "published")
          polls = relevant_polls(tournament, today_games).to_a

          if site_context.mode == "schedule_ready" && site_context.sections["schedule"]
            payload[:schedulePreview] = games_scope.where(status: "scheduled").where(start_time: Time.current..).ordered.limit(4).map(&:api_json)
          end

          render json: payload.merge(
            todayGames: today_games.map(&:api_json),
            liveGames: live_games.map(&:api_json),
            latestNews: tournament.article_links.includes(game: [ :division_record, { home_team: [ :division_record, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ]).latest.limit(5).map(&:api_json),
            gameDayNote: game_day_note&.api_json,
            predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_token_hash) }
          )
        end

        private

        def relevant_polls(tournament, today_games)
          game_ids = today_games.map(&:id)
          tournament.prediction_polls
            .includes(:prediction_votes, { tournament: { teams: [ :division_record, { team_class_memberships: :class_cohort } ] } }, game: [ { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ])
            .where("poll_type = ? OR game_id IN (?)", "tournament", game_ids.presence || [ nil ])
            .ordered
        end

        def voter_token_hash
          token = request.headers["X-FD-Voter-Token"].to_s.strip
          return nil if token.blank?

          PredictionVote.token_hash(token)
        end
      end
    end
  end
end
