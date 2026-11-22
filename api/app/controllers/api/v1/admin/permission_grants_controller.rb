module Api
  module V1
    module Admin
      class PermissionGrantsController < BaseController
        def index
          tournament_ids = access_policy.scope_ids("tournament", capability: "manage_admins", action: "view")
          campaign_ids = access_policy.scope_ids("campaign", capability: "manage_admins", action: "view")
          return render_forbidden unless access_policy.super_admin? || tournament_ids.any? || campaign_ids.any?

          grants = PermissionGrant.active
          memberships = CampaignMembership.active
          unless access_policy.super_admin?
            grants = grants.where(scope_type: "tournament", scope_id: tournament_ids)
              .or(grants.where(scope_type: "campaign", scope_id: campaign_ids))
            memberships = memberships.where(host_campaign_id: campaign_ids)
          end
          by_user = grants.group_by(&:user_id)
          users = access_policy.super_admin? ? User.all : User.where(id: by_user.keys.compact | memberships.distinct.pluck(:user_id))
          render json: {
            presets: Access::Presets.catalog,
            capabilities: Access::Capabilities::ACTIONS,
            users: users.order(:email).map do |user|
              user.api_json.merge(
                superAdmin: user.super_admin?,
                grants: by_user.fetch(user.id, []).map(&:api_json),
                campaignMemberships: user.campaign_memberships_json.select { |entry| campaign_ids.include?(entry[:campaignId].to_i) }
              )
            end,
            pendingInvites: by_user.fetch(nil, []).map(&:api_json),
            tournaments: Tournament.where(id: tournament_ids).order(year: :desc).map(&:api_json),
            campaigns: HostCampaign.where(id: campaign_ids).order(:title).map { |campaign| { id: campaign.id.to_s, title: campaign.title } },
            activeSuperAdminCount: access_policy.super_admin? ? User.active.where(super_admin: true).count : nil
          }
        end

        def assign
          return unless authorize_scope_change

          preset = Access::Presets::DEFINITIONS[params[:presetKey]]
          if params[:presetKey].present? && (!preset || !preset[1].include?(@scope_type))
            return render json: { error: "Choose a preset available for this scope." }, status: :unprocessable_entity
          end
          rows = params[:grants]
          rows ||= preset&.last&.map { |capability, actions| { capability: capability, actions: actions } }
          unless rows.is_a?(Array) && rows.any? && rows.all? { |row| row.respond_to?(:key?) }
            return render json: { error: "Choose at least one capability and its actions." }, status: :unprocessable_entity
          end
          if rows.map { |row| row[:capability] }.uniq.size != rows.size
            return render json: { error: "Each capability may appear once." }, status: :unprocessable_entity
          end
          return unless authorize_delegated_grants(rows)

          changes = with_locked_scope do |user|
            unless can_modify_target_scope?(user)
              render_forbidden("You cannot modify permissions that you do not hold in this scope.")
              raise ActiveRecord::Rollback
            end

            revoke_grants(user)
            verified_user = user&.clerk_id.present? ? user : nil
            rows.map do |row|
              PermissionGrant.create!(
                email: @email, scope_type: @scope_type, scope_id: @scope_id,
                capability: row[:capability], actions: row[:actions], preset_key: params[:presetKey],
                user: verified_user, accepted_at: verified_user && Time.current, granted_by: current_user
              )
            end
          end
          return if performed?

          render json: { grants: changes.map(&:api_json) }, status: :created
        rescue ActiveRecord::RecordInvalid => error
          render_errors(error.record)
        end

        def revoke_scope
          return unless authorize_scope_change

          with_locked_scope do |user|
            unless can_modify_target_scope?(user)
              render_forbidden("You cannot revoke permissions that you do not hold in this scope.")
              raise ActiveRecord::Rollback
            end

            revoke_grants(user)
            if @scope_type == "campaign"
              CampaignMembership.active.where(user: user, host_campaign_id: @scope_id).update_all(active: false, updated_at: Time.current) if user
              CampaignInvitation.pending_for_email(@email).where(host_campaign_id: @scope_id).update_all(revoked_at: Time.current, updated_at: Time.current)
            end
          end
          return if performed?

          head :no_content
        end

        private

        def authorize_scope_change
          @email = params[:email].to_s.strip.downcase
          @scope_type = params[:scopeType].to_s
          @scope_id = Integer(params[:scopeId].to_s, 10, exception: false) if params[:scopeId].present?
          valid_scope = case @scope_type
          when "site" then params[:scopeId].blank?
          when "tournament" then Tournament.exists?(id: @scope_id)
          when "campaign" then HostCampaign.exists?(id: @scope_id)
          end
          unless valid_scope && @email.match?(URI::MailTo::EMAIL_REGEXP)
            render json: { error: "Enter a valid email and access scope." }, status: :unprocessable_entity
            return false
          end
          return true if access_policy.super_admin?
          if @scope_type == "site"
            render_forbidden
            return false
          end
          if @email == current_user.email.downcase
            render_forbidden("You cannot change your own access grants.")
            return false
          end

          authorize!("manage_admins", "edit", type: @scope_type, id: @scope_id)
        end

        def authorize_delegated_grants(rows)
          return true if access_policy.super_admin?

          allowed = rows.all? do |row|
            capability = row[:capability].to_s
            actions = Array(row[:actions]).map(&:to_s)
            actions.any? && actions.all? do |action|
              access_policy.allows?(capability, action, scope_type: @scope_type, scope_id: @scope_id)
            end
          end
          return true if allowed

          render_forbidden("You can only grant permissions that you already hold in this scope.")
          false
        end

        def can_modify_target_scope?(user)
          return true if access_policy.super_admin?
          return false if user&.super_admin?

          existing_grants = existing_scoped_grants(user).to_a
          grants_allowed = existing_grants.all? do |grant|
            grant.actions.all? do |action|
              access_policy.allows?(grant.capability, action, scope_type: @scope_type, scope_id: @scope_id)
            end
          end
          return false unless grants_allowed

          return true unless @scope_type == "campaign" && user

          explicit_caps = existing_grants.map(&:capability)
          roles = CampaignMembership.active.where(user: user, host_campaign_id: @scope_id).pluck(:role)
          roles.all? do |role|
            Access::Policy::LEGACY_CAMPAIGN_ACTIONS.fetch(role, {}).except(*explicit_caps).all? do |capability, actions|
              actions.all? { |action| access_policy.allows?(capability, action, scope_type: @scope_type, scope_id: @scope_id) }
            end
          end
        end

        def existing_scoped_grants(user)
          scoped = PermissionGrant.active.where(scope_type: @scope_type, scope_id: @scope_id)
          matches = scoped.where(email: @email)
          user ? matches.or(scoped.where(user: user)) : matches
        end

        def with_locked_scope
          PermissionGrant.transaction(requires_new: true) do
            PermissionGrant.connection.execute(
              "SELECT pg_advisory_xact_lock(hashtextextended(#{PermissionGrant.connection.quote(@email)}, 0))"
            )
            yield User.find_by(email: @email)
          end
        end

        def revoke_grants(user)
          existing_scoped_grants(user).update_all(revoked_at: Time.current, updated_at: Time.current)
        end
      end
    end
  end
end
