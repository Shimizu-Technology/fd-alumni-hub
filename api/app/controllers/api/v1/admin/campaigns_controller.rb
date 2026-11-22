module Api
  module V1
    module Admin
      class CampaignsController < BaseController
        before_action :require_admin!

        def index
          campaigns = HostCampaign.includes(:tournament, :class_cohort).order(featured: :desc, created_at: :desc)
          render json: { campaigns: campaigns.map(&:admin_json) }
        end

        def show
          campaign = HostCampaign.includes(:tournament, :class_cohort).find(params[:id])
          render json: { campaign: campaign.admin_json }
        end

        def create
          campaign = HostCampaign.new(campaign_params)

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

          if campaign.archived? && reason.blank?
            return render json: { error: "Archived campaign is read-only; supply breakGlassReason for an audited admin override." },
              status: :unprocessable_entity
          end

          HostCampaign.transaction do
            campaign.assign_attributes(campaign_params)
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

        private

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
