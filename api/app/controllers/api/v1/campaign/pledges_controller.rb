module Api
  module V1
    module Campaign
      class PledgesController < BaseController
        before_action -> { require_campaign_role!("board", "chair", "treasurer") }, only: [ :index ]
        before_action -> { require_campaign_role!("treasurer") }, only: [ :create, :update ]
        before_action :require_campaign_writable!, only: [ :create, :update ]

        def index
          pledges = @campaign.pledges.includes(:sponsor, :recorded_by).ordered.to_a
          received_by_id = @campaign.ledger_entries
            .live
            .where(entry_type: "income")
            .where.not(pledge_id: nil)
            .group(:pledge_id)
            .sum(:amount_cents)

          render json: {
            pledges: pledges.map { |pledge| pledge.api_json(received_cents: received_by_id[pledge.id].to_i) },
            sponsors: @campaign.tournament.sponsors.order(:name).map { |s| { id: s.id.to_s, name: s.name } }
          }
        end

        def create
          pledge = @campaign.pledges.build(pledge_params.merge(recorded_by: current_user))

          Pledge.transaction do
            unless pledge.save
              render_errors(pledge)
              raise ActiveRecord::Rollback
            end

            record_audit!(
              record: pledge,
              action: "create",
              changes: {
                "donor_name" => pledge.donor_name,
                "promised_cents" => pledge.promised_cents,
                "is_in_kind" => pledge.is_in_kind,
                "status" => pledge.status
              }
            )
          end
          return if performed?

          render json: { pledge: pledge.api_json(received_cents: 0) }, status: :created
        end

        def update
          pledge = @campaign.pledges.find(params[:id])

          Pledge.transaction do
            pledge.lock!
            pledge.assign_attributes(pledge_params)
            changes = pledge.changes
            unless pledge.save
              render_errors(pledge)
              raise ActiveRecord::Rollback
            end

            pledge.sync_fulfillment_status! unless pledge.cancelled?
            record_audit!(record: pledge, action: "update", changes: changes) if changes.any?
          end
          return if performed?

          render json: { pledge: pledge.api_json }
        end

        private

        def pledge_params
          raw = params.fetch(:pledge, params)
          permitted = raw.permit(
            :sponsor_id, :sponsorId,
            :donor_name, :donorName,
            :contact_info, :contactInfo,
            :tier,
            :is_in_kind, :isInKind,
            :promised_cents, :promisedCents,
            :due_on, :dueOn,
            :status,
            :notes
          )

          attrs = {}
          assign_param(attrs, permitted, :sponsor_id, :sponsor_id, :sponsorId)
          assign_param(attrs, permitted, :donor_name, :donor_name, :donorName)
          assign_param(attrs, permitted, :contact_info, :contact_info, :contactInfo)
          assign_param(attrs, permitted, :tier, :tier)
          assign_param(attrs, permitted, :is_in_kind, :is_in_kind, :isInKind)
          assign_param(attrs, permitted, :promised_cents, :promised_cents, :promisedCents)
          assign_param(attrs, permitted, :due_on, :due_on, :dueOn)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :notes, :notes)
          attrs
        end
      end
    end
  end
end
