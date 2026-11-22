module Api
  module V1
    module Admin
      class CampaignInvitationsController < BaseController
        before_action :require_admin!
        before_action :load_campaign

        def index
          invitations = @campaign.campaign_invitations.includes(:invited_by).recent_first
          render json: { invitations: invitations.map(&:api_json) }
        end

        def create
          invitation = @campaign.campaign_invitations.build(invitation_params.merge(invited_by: current_user))

          CampaignInvitation.transaction do
            unless invitation.save
              render_errors(invitation)
              raise ActiveRecord::Rollback
            end

            FinanceAuditEvent.record!(
              campaign: @campaign,
              actor: current_user,
              record: invitation,
              action: "create_invitation",
              changes: { "email" => invitation.email, "role" => invitation.role },
              ip_address: request.remote_ip
            )
          end
          return if performed?

          render json: { invitation: invitation.api_json }, status: :created
        end

        def revoke
          invitation = @campaign.campaign_invitations.find(params[:id])
          return render json: { error: "Invitation is no longer pending" }, status: :unprocessable_entity unless invitation.pending?

          CampaignInvitation.transaction do
            invitation.update!(revoked_at: Time.current)
            FinanceAuditEvent.record!(
              campaign: @campaign,
              actor: current_user,
              record: invitation,
              action: "revoke_invitation",
              changes: { "email" => invitation.email, "role" => invitation.role },
              ip_address: request.remote_ip
            )
          end

          render json: { invitation: invitation.api_json }
        end

        private

        def load_campaign
          @campaign = HostCampaign.find(params[:campaign_id])
        end

        def invitation_params
          raw = params.fetch(:invitation, params)
          permitted = raw.permit(:email)
          attrs = {}
          assign_param(attrs, permitted, :email, :email)
          if raw.key?(:role)
            attrs[:role] = CampaignInvitation::ROLES.find { |r| r == raw[:role].to_s } || raw[:role].to_s
          end
          attrs
        end
      end
    end
  end
end
