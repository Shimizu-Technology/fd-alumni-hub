module Api
  module V1
    module Campaign
      class SettingsController < BaseController
        CONTENT_KEYS = %i[
          title
          tagline
          description
          countdown_target_at
          countdown_label
          hero_image_url
          golf_url
          hafapass_organizer_slug
          hafapass_tournament_organizer_slug
          hafapass_distribution_code
        ].freeze

        FINANCE_KEYS = %i[
          goal_cents
          fdaa_upfront_cents
          fdaa_ticket_share_bps
          public_meter_enabled
          include_fdaa_in_public_meter
        ].freeze

        DONATION_KEYS = %i[
          donation_url
          donation_instructions
        ].freeze

        IGNORED_RAW_KEYS = %w[campaign_slug controller action format breakGlassReason break_glass_reason campaign].freeze

        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "view", "board", "chair", "treasurer") }, only: :show
        before_action :require_campaign_writable!, only: [ :update ]

        def show
          render json: {
            campaign: @campaign.admin_json,
            roles: current_user.admin? ? %w[admin] : current_campaign_roles
          }
        end

        def update
          allowed = campaign_role?("chair", "treasurer") ||
            %w[edit manage_donation_links].any? { |action| explicit_setting_access?("fundraisers_and_sponsors", action) } ||
            explicit_setting_access?("finance_and_reimbursements", "record")
          return render_forbidden unless allowed

          unknown_raw_keys = unexpected_raw_keys
          if unknown_raw_keys.any?
            return render_forbidden("Not permitted to update fields: #{unknown_raw_keys.join(', ')}")
          end

          attrs = extract_settings_attrs
          unauthorized = unauthorized_keys(attrs.keys)
          if unauthorized.any?
            return render_forbidden("Not permitted to update fields: #{unauthorized.join(', ')}")
          end

          HostCampaign.transaction do
            @campaign.assign_attributes(attrs)
            changes = @campaign.changes
            unless @campaign.save
              render_errors(@campaign)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: @campaign, action: "settings_change", changes: changes) if changes.any?
          end
          return if performed?

          render json: { campaign: @campaign.admin_json }
        end

        private

        def unexpected_raw_keys
          raw = params.fetch(:campaign, params)
          raw_keys = raw.to_unsafe_h.keys.map(&:to_s) - IGNORED_RAW_KEYS
          allowed_raw = (CONTENT_KEYS + FINANCE_KEYS + DONATION_KEYS).flat_map { |k| [ k.to_s, k.to_s.camelize(:lower) ] }
          raw_keys - allowed_raw
        end

        def unauthorized_keys(keys)
          return [] if current_user.admin?

          keys.select do |key|
            if DONATION_KEYS.include?(key)
              !explicit_setting_access?("fundraisers_and_sponsors", "manage_donation_links")
            elsif FINANCE_KEYS.include?(key)
              !legacy_setting_access?("finance_and_reimbursements", "treasurer") && !explicit_setting_access?("finance_and_reimbursements", "record")
            elsif CONTENT_KEYS.include?(key)
              !legacy_setting_access?("fundraisers_and_sponsors", "chair") && !explicit_setting_access?("fundraisers_and_sponsors", "edit")
            else
              true
            end
          end
        end

        def explicit_setting_access?(capability, action)
          Access::Policy.new(current_user).explicitly_allows?(capability, action, scope_type: "campaign", scope_id: @campaign.id)
        end

        def legacy_setting_access?(capability, role)
          campaign_role?(role) && !current_user.permission_grants.exists?(scope_type: "campaign", scope_id: @campaign.id, capability: capability)
        end

        def extract_settings_attrs
          raw = params.fetch(:campaign, params)
          permitted = raw.permit(
            :title, :tagline, :description,
            :countdown_target_at, :countdownTargetAt,
            :countdown_label, :countdownLabel,
            :hero_image_url, :heroImageUrl,
            :golf_url, :golfUrl,
            :hafapass_organizer_slug, :hafapassOrganizerSlug,
            :hafapass_tournament_organizer_slug, :hafapassTournamentOrganizerSlug,
            :hafapass_distribution_code, :hafapassDistributionCode,
            :goal_cents, :goalCents,
            :fdaa_upfront_cents, :fdaaUpfrontCents,
            :fdaa_ticket_share_bps, :fdaaTicketShareBps,
            :public_meter_enabled, :publicMeterEnabled,
            :include_fdaa_in_public_meter, :includeFdaaInPublicMeter,
            :donation_url, :donationUrl,
            :donation_instructions, :donationInstructions
          )

          attrs = {}
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :tagline, :tagline)
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :countdown_target_at, :countdown_target_at, :countdownTargetAt)
          assign_param(attrs, permitted, :countdown_label, :countdown_label, :countdownLabel)
          assign_param(attrs, permitted, :hero_image_url, :hero_image_url, :heroImageUrl)
          assign_param(attrs, permitted, :golf_url, :golf_url, :golfUrl)
          assign_param(attrs, permitted, :hafapass_organizer_slug, :hafapass_organizer_slug, :hafapassOrganizerSlug)
          assign_param(attrs, permitted, :hafapass_tournament_organizer_slug, :hafapass_tournament_organizer_slug, :hafapassTournamentOrganizerSlug)
          assign_param(attrs, permitted, :hafapass_distribution_code, :hafapass_distribution_code, :hafapassDistributionCode)
          assign_param(attrs, permitted, :goal_cents, :goal_cents, :goalCents)
          assign_param(attrs, permitted, :fdaa_upfront_cents, :fdaa_upfront_cents, :fdaaUpfrontCents)
          assign_param(attrs, permitted, :fdaa_ticket_share_bps, :fdaa_ticket_share_bps, :fdaaTicketShareBps)
          assign_param(attrs, permitted, :public_meter_enabled, :public_meter_enabled, :publicMeterEnabled)
          assign_param(attrs, permitted, :include_fdaa_in_public_meter, :include_fdaa_in_public_meter, :includeFdaaInPublicMeter)
          assign_param(attrs, permitted, :donation_url, :donation_url, :donationUrl)
          assign_param(attrs, permitted, :donation_instructions, :donation_instructions, :donationInstructions)
          attrs
        end
      end
    end
  end
end
