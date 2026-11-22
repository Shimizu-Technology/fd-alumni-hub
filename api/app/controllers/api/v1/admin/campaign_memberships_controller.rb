module Api
  module V1
    module Admin
      class CampaignMembershipsController < BaseController
        before_action :require_admin!
        before_action :load_campaign

        def index
          memberships = @campaign.campaign_memberships.includes(:user).order(:role, :created_at)
          render json: {
            memberships: memberships.map(&:api_json),
            users: User.active.order(:email).map { |u| { id: u.id.to_s, email: u.email, fullName: u.full_name, role: u.role } }
          }
        end

        def create
          attrs = membership_params
          target_user = User.active.find_by(id: attrs[:user_id])
          unless target_user
            return render json: { errors: [ "Active user not found" ] }, status: :unprocessable_entity
          end

          membership = @campaign.campaign_memberships.find_or_initialize_by(
            user_id: target_user.id,
            role: attrs[:role]
          )
          was_new = membership.new_record?
          membership.active = true
          membership.invited_by ||= current_user

          CampaignMembership.transaction do
            changes = membership.changes
            unless membership.save
              render_errors(membership)
              raise ActiveRecord::Rollback
            end

            if was_new || changes.any?
              FinanceAuditEvent.record!(
                campaign: @campaign,
                actor: current_user,
                record: membership,
                action: "membership_grant",
                changes: { "user_id" => membership.user_id, "role" => membership.role, "active" => membership.active },
                ip_address: request.remote_ip
              )
            end
          end
          return if performed?

          render json: { membership: membership.api_json }, status: was_new ? :created : :ok
        rescue ActiveRecord::RecordNotUnique
          render json: { errors: [ "User already holds this campaign role" ] }, status: :unprocessable_entity
        end

        def update
          membership = @campaign.campaign_memberships.find(params[:id])

          CampaignMembership.transaction do
            membership.assign_attributes(membership_update_params)
            changes = membership.changes
            unless membership.save
              render_errors(membership)
              raise ActiveRecord::Rollback
            end

            if changes.any?
              FinanceAuditEvent.record!(
                campaign: @campaign,
                actor: current_user,
                record: membership,
                action: "membership_change",
                changes: changes,
                ip_address: request.remote_ip
              )
            end
          end
          return if performed?

          render json: { membership: membership.api_json }
        end

        private

        def load_campaign
          @campaign = HostCampaign.find(params[:campaign_id])
        end

        def membership_params
          raw = params.fetch(:membership, params)
          permitted = raw.permit(:user_id, :userId)
          attrs = {}
          assign_param(attrs, permitted, :user_id, :user_id, :userId)
          if raw.key?(:role)
            attrs[:role] = CampaignMembership::ROLES.find { |r| r == raw[:role].to_s } || raw[:role].to_s
          end
          attrs
        end

        def membership_update_params
          raw = params.fetch(:membership, params)
          permitted = raw.permit(:active)
          attrs = {}
          assign_param(attrs, permitted, :active, :active)
          attrs
        end
      end
    end
  end
end
