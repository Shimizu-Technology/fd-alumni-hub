module Api
  module V1
    module Campaign
      class PledgesController < BaseController
        before_action -> { require_campaign_access!("finance_and_reimbursements", "view", "board", "chair", "treasurer") }, only: :index
        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :create
        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :update
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
          attrs = pledge_params
          return if performed?

          pledge = @campaign.pledges.build(attrs.merge(recorded_by: current_user))
          if !pledge.is_in_kind? && !%w[promised cancelled].include?(pledge.status.to_s.strip.downcase.presence || "promised")
            return render json: { error: "New cash pledges must start as 'promised' or 'cancelled'; fulfillment updates automatically from income entries." },
              status: :unprocessable_entity
          end

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
          attrs = pledge_params
          return if performed?

          pledge = @campaign.pledges.find(params[:id])

          Pledge.transaction do
            pledge.lock!
            before_snapshot = pledge.attributes.slice("sponsor_id", "donor_name", "tier", "is_in_kind", "promised_cents", "due_on", "status", "notes")
            pledge.assign_attributes(attrs)
            unless pledge.save
              render_errors(pledge)
              raise ActiveRecord::Rollback
            end

            pledge.sync_fulfillment_status! unless pledge.cancelled? || pledge.is_in_kind?

            after_snapshot = pledge.attributes.slice("sponsor_id", "donor_name", "tier", "is_in_kind", "promised_cents", "due_on", "status", "notes")
            real_changes = {}
            before_snapshot.each do |k, old_val|
              new_val = after_snapshot[k]
              real_changes[k] = [ old_val, new_val ] if old_val != new_val
            end

            record_audit!(record: pledge, action: "update", changes: real_changes) if real_changes.any?
          end
          return if performed?

          render json: { pledge: pledge.api_json }
        end

        private

        def pledge_params
          raw = extract_object_params(:pledge)
          return {} unless raw

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
          if permitted.key?(:due_on) || permitted.key?(:dueOn)
            raw_due = permitted.key?(:due_on) ? permitted[:due_on] : permitted[:dueOn]
            ok, parsed_or_error = parse_strict_iso_date(raw_due, field_label: "dueOn")
            unless ok
              render json: { error: parsed_or_error }, status: :unprocessable_entity
              return {}
            end
            attrs[:due_on] = parsed_or_error
          end
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :notes, :notes)
          attrs
        end
      end
    end
  end
end
