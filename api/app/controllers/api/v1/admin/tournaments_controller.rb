module Api
  module V1
    module Admin
      class TournamentsController < BaseController
        before_action :require_admin!, only: [ :create, :update, :setup ]

        def index
          tournaments = Tournament.order(year: :desc, start_date: :desc)
          render json: { tournaments: tournaments.map(&:api_json) }
        end

        def show
          tournament = Tournament.find(params[:id])
          render json: { tournament: tournament.api_json }
        end

        def create
          tournament = Tournament.new(tournament_params)

          if tournament.save
            tournament.ensure_default_divisions! if seed_default_divisions?
            render json: {
              tournament: tournament.api_json,
              divisions: tournament.divisions.ordered.map { |division| division.api_json(tournament: tournament) }
            }, status: :created
          else
            render_errors(tournament)
          end
        end

        def setup
          result = Tournaments::Bootstrap.call(
            tournament_attrs: setup_tournament_attrs,
            divisions: setup_divisions_attrs,
            seed_default_divisions: setup_divisions_attrs.nil?,
            campaign_attrs: setup_campaign_attrs,
            actor: current_user,
            ip_address: request.remote_ip
          )

          render json: {
            tournament: result.tournament.api_json,
            divisions: result.divisions.map { |division| division.api_json(tournament: result.tournament) },
            hostCampaign: result.host_campaign&.admin_json
          }, status: :created
        rescue Tournaments::Bootstrap::Error => e
          render json: { errors: [ e.message ] }, status: :unprocessable_entity
        rescue ActiveRecord::RecordNotFound => e
          render json: { errors: [ e.message ] }, status: :unprocessable_entity
        rescue ActiveRecord::RecordInvalid => e
          render_errors(e.record)
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "A tournament, division, or campaign with those unique fields already exists." ] }, status: :unprocessable_entity
        end

        def update
          tournament = Tournament.find(params[:id])

          if tournament.update(tournament_params)
            render json: { tournament: tournament.api_json }
          else
            render_errors(tournament)
          end
        end

        def recompute_standings
          tournament = Tournament.find(params[:id])
          result = Standings::Recompute.call(tournament)
          tournament.standings.reset

          render json: {
            tournament: tournament.api_json,
            recompute: { teams: result.teams, games: result.games },
            standings: tournament.standings.ranked.map(&:api_json),
            scoreCoverage: Standings::Coverage.for(tournament)
          }
        end

        private

        def seed_default_divisions?
          raw = params.fetch(:tournament, params)
          flag = raw[:seedDefaultDivisions]
          flag = raw[:seed_default_divisions] if flag.nil?
          flag = params[:seedDefaultDivisions] if flag.nil?
          flag = params[:seed_default_divisions] if flag.nil?
          return true if flag.nil?

          ActiveModel::Type::Boolean.new.cast(flag)
        end

        def setup_tournament_attrs
          raw = params[:tournament]
          return {} unless raw.is_a?(ActionController::Parameters)

          permitted = raw.permit(:name, :year, :status, :start_date, :end_date, :startDate, :endDate)
          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :year, :year)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :start_date, :start_date, :startDate)
          assign_param(attrs, permitted, :end_date, :end_date, :endDate)
          attrs
        end

        def setup_divisions_attrs
          raw = params[:divisions]
          return nil unless raw.is_a?(Array)

          raw.map do |entry|
            raw_hash = entry.respond_to?(:to_unsafe_h) ? entry.to_unsafe_h : entry
            raw_hash = {} unless raw_hash.is_a?(Hash)
            permitted = ActionController::Parameters.new(raw_hash).permit(:name, :slug, :position, :counts_for_standings, :countsForStandings, :active)
            attrs = {}
            assign_param(attrs, permitted, :name, :name)
            assign_param(attrs, permitted, :slug, :slug)
            assign_param(attrs, permitted, :position, :position)
            assign_param(attrs, permitted, :counts_for_standings, :counts_for_standings, :countsForStandings)
            assign_param(attrs, permitted, :active, :active)
            attrs
          end
        end

        def setup_campaign_attrs
          raw = params[:hostCampaign] || params[:host_campaign] || params[:campaign]
          return nil unless raw.is_a?(ActionController::Parameters)

          permitted = raw.permit(
            :title, :slug, :goal_cents, :goalCents,
            :class_cohort_id, :classCohortId, :host_class_year, :hostClassYear,
            :fdaa_upfront_cents, :fdaaUpfrontCents,
            :fdaa_ticket_share_bps, :fdaaTicketShareBps
          )
          attrs = {}
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :slug, :slug)
          assign_param(attrs, permitted, :goal_cents, :goal_cents, :goalCents)
          assign_param(attrs, permitted, :class_cohort_id, :class_cohort_id, :classCohortId)
          assign_param(attrs, permitted, :host_class_year, :host_class_year, :hostClassYear)
          assign_param(attrs, permitted, :fdaa_upfront_cents, :fdaa_upfront_cents, :fdaaUpfrontCents)
          assign_param(attrs, permitted, :fdaa_ticket_share_bps, :fdaa_ticket_share_bps, :fdaaTicketShareBps)
          attrs.presence
        end

        def tournament_params
          raw = params.fetch(:tournament, params)
          permitted = raw.permit(:name, :year, :status, :start_date, :end_date, :startDate, :endDate)

          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :year, :year)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :start_date, :start_date, :startDate)
          assign_param(attrs, permitted, :end_date, :end_date, :endDate)
          attrs
        end
      end
    end
  end
end
