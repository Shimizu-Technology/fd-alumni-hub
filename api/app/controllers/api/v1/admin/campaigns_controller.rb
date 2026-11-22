module Api
  module V1
    module Admin
      class CampaignsController < BaseController
        before_action :require_admin!, except: [ :index, :show ]

        def index
          return render_forbidden if access_policy.capabilities.empty? || (!access_policy.super_admin? && access_policy.scope_ids("campaign").empty?)
          capability = params[:capability].presence
          ids = access_policy.scope_ids("campaign", capability: capability, action: capability && "view")
          campaigns = HostCampaign.where(id: ids).includes(:tournament, :class_cohort).order(featured: :desc, created_at: :desc)
          payload = if access_policy.super_admin? && !capability
            campaigns.map(&:admin_json)
          else
            campaigns.map { |campaign| campaign.slice(:id, :slug, :title, :status).merge("id" => campaign.id.to_s) }
          end
          render json: { campaigns: payload }
        end

        def show
          return render_forbidden unless access_policy.super_admin? || access_policy.scope_ids("campaign").include?(params[:id].to_i)
          campaign = HostCampaign.includes(:tournament, :class_cohort).find(params[:id])
          payload = if access_policy.super_admin?
            campaign.admin_json
          else
            campaign.slice(:slug, :title, :status).merge("id" => campaign.id.to_s)
          end
          render json: { campaign: payload }
        end

        def create
          incoming = campaign_params
          if incoming[:status].to_s.strip.downcase == "archived"
            return render json: {
              error: "New campaigns cannot be created as archived; use POST /api/v1/admin/campaigns/:id/archive after close-out checks."
            }, status: :unprocessable_entity
          end

          campaign = HostCampaign.new(incoming)

          HostCampaign.transaction do
            unless campaign.save
              render_errors(campaign)
              raise ActiveRecord::Rollback
            end

            FinanceAuditEvent.record!(
              campaign: campaign,
              actor: current_user,
              record: campaign,
              action: "create_campaign",
              changes: { "slug" => campaign.slug, "status" => campaign.status, "goal_cents" => campaign.goal_cents },
              ip_address: request.remote_ip
            )
          end
          return if performed?

          render json: { campaign: campaign.admin_json }, status: :created
        end

        def update
          campaign = HostCampaign.find(params[:id])
          reason = break_glass_reason
          incoming = campaign_params

          if !campaign.archived? && incoming[:status].to_s.strip.downcase == "archived"
            return render json: {
              error: "Use POST /api/v1/admin/campaigns/:id/archive to archive a campaign after close-out checks."
            }, status: :unprocessable_entity
          end

          if campaign.archived? && reason.blank?
            return render json: { error: "Archived campaign is read-only; supply breakGlassReason for an audited admin override." },
              status: :unprocessable_entity
          end

          HostCampaign.transaction do
            campaign.assign_attributes(incoming)
            changes = campaign.changes
            unless campaign.save
              render_errors(campaign)
              raise ActiveRecord::Rollback
            end

            if changes.any?
              FinanceAuditEvent.record!(
                campaign: campaign,
                actor: current_user,
                record: campaign,
                action: "admin_update_campaign",
                changes: changes,
                reason: reason,
                ip_address: request.remote_ip
              )
            end
          end
          return if performed?

          render json: { campaign: campaign.admin_json }
        end

        def closeout_check
          campaign = HostCampaign.includes(:tournament).find(params[:id])
          render json: HostCampaigns::CloseoutCheck.call(campaign)
        end

        def archive
          force_reason = params[:forceReason].to_s.strip.presence ||
            params[:force_reason].to_s.strip.presence
          complete_tournament = ActiveModel::Type::Boolean.new.cast(
            params.key?(:completeTournament) ? params[:completeTournament] : params[:complete_tournament]
          ) == true

          archived_campaign = nil
          check = nil

          HostCampaign.transaction do
            campaign = HostCampaign.lock.find(params[:id])
            if campaign.archived?
              render json: { error: "Campaign is already archived." }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            check = HostCampaigns::CloseoutCheck.call(campaign)
            if check[:blockers].any? && force_reason.to_s.length < 5
              render json: {
                error: "Close-out blockers remain; resolve them or supply a forceReason (at least 5 characters) for an audited override.",
                closeoutCheck: check
              }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            previous_status = campaign.status
            previous_featured = campaign.featured
            campaign.update!(status: "archived", featured: false)

            tournament_completed = false
            if complete_tournament && campaign.tournament && campaign.tournament.status.in?(%w[upcoming live])
              campaign.tournament.update!(status: "completed")
              tournament_completed = true
            end

            FinanceAuditEvent.record!(
              campaign: campaign,
              actor: current_user,
              record: campaign,
              action: "archive_campaign",
              changes: {
                "status" => [ previous_status, "archived" ],
                "featured" => [ previous_featured, false ],
                "tournament_completed" => tournament_completed,
                "blockers_overridden" => check[:blockers].map { |b| b[:code] },
                "warnings_at_archive" => check[:warnings].map { |w| w[:code] }
              },
              reason: force_reason,
              ip_address: request.remote_ip
            )
            archived_campaign = campaign
          end
          return if performed?

          render json: {
            campaign: archived_campaign.admin_json,
            tournament: archived_campaign.tournament&.api_json,
            closeoutCheck: check
          }
        rescue ActiveRecord::RecordInvalid => e
          render_errors(e.record)
        end

        def clone
          source = HostCampaign.includes(:tournament).find(params[:id])
          raw = params.fetch(:clone, params)
          begin
            result = HostCampaigns::Clone.call(
              source_campaign: source,
              actor: current_user,
              ip_address: request.remote_ip,
              target_tournament_id: raw[:targetTournamentId].presence || raw[:target_tournament_id].presence,
              tournament_attrs: clone_tournament_attrs(raw),
              class_cohort_id: raw[:classCohortId].presence || raw[:class_cohort_id].presence,
              host_class_year: raw[:hostClassYear].presence || raw[:host_class_year].presence,
              title: raw[:title].presence,
              slug: raw[:slug].presence,
              goal_cents: raw[:goalCents].presence || raw[:goal_cents].presence,
              copy_divisions: cast_default_bool(raw, :copyDivisions, :copy_divisions, default: true),
              copy_budget_categories: cast_default_bool(raw, :copyBudgetCategories, :copy_budget_categories, default: true),
              copy_budget_amounts: cast_default_bool(raw, :copyBudgetAmounts, :copy_budget_amounts, default: false),
              copy_event_templates: cast_default_bool(raw, :copyEventTemplates, :copy_event_templates, default: true)
            )

            render json: {
              campaign: result.host_campaign.admin_json,
              tournament: result.tournament.api_json,
              divisions: result.divisions.map { |d| d.api_json(tournament: result.tournament) },
              budgetLinesCount: result.budget_lines.length,
              campaignEventsCount: result.campaign_events.length
            }, status: :created
          rescue HostCampaigns::Clone::Error, Tournaments::Bootstrap::Error => e
            render json: { errors: [ e.message ] }, status: :unprocessable_entity
          rescue ActiveRecord::RecordNotFound => e
            render json: { errors: [ e.message ] }, status: :unprocessable_entity
          rescue ActiveRecord::RecordInvalid => e
            render_errors(e.record)
          rescue ActiveRecord::RecordNotUnique
            render json: { errors: [ "A campaign or tournament with those unique fields already exists." ] }, status: :unprocessable_entity
          end
        end

        private

        def cast_default_bool(raw, camel_key, snake_key, default:)
          val = raw.key?(camel_key) ? raw[camel_key] : (raw.key?(snake_key) ? raw[snake_key] : nil)
          return default if val.nil?

          ActiveModel::Type::Boolean.new.cast(val) == true
        end

        def clone_tournament_attrs(raw)
          t = raw[:tournament]
          return nil unless t.is_a?(ActionController::Parameters)

          permitted = t.permit(:name, :year, :start_date, :end_date, :startDate, :endDate)
          attrs = {}
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :year, :year)
          assign_param(attrs, permitted, :start_date, :start_date, :startDate)
          assign_param(attrs, permitted, :end_date, :end_date, :endDate)
          return nil if attrs.empty?

          attrs[:status] = "upcoming"
          attrs
        end

        def break_glass_reason
          params[:breakGlassReason].presence ||
            params[:break_glass_reason].presence ||
            params.dig(:campaign, :breakGlassReason).presence ||
            params.dig(:campaign, :break_glass_reason).presence
        end

        def campaign_params
          raw = params.fetch(:campaign, params)
          permitted = raw.permit(
            :tournament_id, :tournamentId,
            :class_cohort_id, :classCohortId,
            :slug, :title, :tagline, :description,
            :status, :featured,
            :goal_cents, :goalCents,
            :countdown_target_at, :countdownTargetAt,
            :countdown_label, :countdownLabel,
            :hero_image_url, :heroImageUrl,
            :donation_url, :donationUrl,
            :donation_instructions, :donationInstructions,
            :golf_url, :golfUrl,
            :hafapass_organizer_slug, :hafapassOrganizerSlug,
            :hafapass_tournament_organizer_slug, :hafapassTournamentOrganizerSlug,
            :hafapass_distribution_code, :hafapassDistributionCode,
            :fdaa_upfront_cents, :fdaaUpfrontCents,
            :fdaa_ticket_share_bps, :fdaaTicketShareBps,
            :public_meter_enabled, :publicMeterEnabled,
            :include_fdaa_in_public_meter, :includeFdaaInPublicMeter
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :class_cohort_id, :class_cohort_id, :classCohortId)
          assign_param(attrs, permitted, :slug, :slug)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :tagline, :tagline)
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :featured, :featured)
          assign_param(attrs, permitted, :goal_cents, :goal_cents, :goalCents)
          assign_param(attrs, permitted, :countdown_target_at, :countdown_target_at, :countdownTargetAt)
          assign_param(attrs, permitted, :countdown_label, :countdown_label, :countdownLabel)
          assign_param(attrs, permitted, :hero_image_url, :hero_image_url, :heroImageUrl)
          assign_param(attrs, permitted, :donation_url, :donation_url, :donationUrl)
          assign_param(attrs, permitted, :donation_instructions, :donation_instructions, :donationInstructions)
          assign_param(attrs, permitted, :golf_url, :golf_url, :golfUrl)
          assign_param(attrs, permitted, :hafapass_organizer_slug, :hafapass_organizer_slug, :hafapassOrganizerSlug)
          assign_param(attrs, permitted, :hafapass_tournament_organizer_slug, :hafapass_tournament_organizer_slug, :hafapassTournamentOrganizerSlug)
          assign_param(attrs, permitted, :hafapass_distribution_code, :hafapass_distribution_code, :hafapassDistributionCode)
          assign_param(attrs, permitted, :fdaa_upfront_cents, :fdaa_upfront_cents, :fdaaUpfrontCents)
          assign_param(attrs, permitted, :fdaa_ticket_share_bps, :fdaa_ticket_share_bps, :fdaaTicketShareBps)
          assign_param(attrs, permitted, :public_meter_enabled, :public_meter_enabled, :publicMeterEnabled)
          assign_param(attrs, permitted, :include_fdaa_in_public_meter, :include_fdaa_in_public_meter, :includeFdaaInPublicMeter)
          attrs
        end
      end
    end
  end
end
