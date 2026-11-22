require "csv"

module Api
  module V1
    module Campaign
      class LedgerEntriesController < BaseController
        RAW_RECEIPT_PARAM_KEYS = %w[
          receipt_key receiptKey
          receipt_filename receiptFilename
          receipt_content_type receiptContentType
          receipt_byte_size receiptByteSize
        ].freeze

        IMMUTABLE_UPDATE_KEYS = %w[
          entry_type entryType
          amount_cents amountCents
          entry_date entryDate
          source
          payment_method paymentMethod
          counterparty
          paid_by paidBy
          paid_by_user_id paidByUserId
          pledge_id pledgeId
          reimbursement_status reimbursementStatus
          reimbursement_approved_by_id reimbursementApprovedById
          reimbursed_at reimbursedAt
          reimbursement_reference reimbursementReference
          voided_at voidedAt
          voided_by_id voidedById
          void_reason voidReason
        ].freeze

        CSV_FORMULA_REGEX = /\A[\t\r\n]|^\s*[=+\-@]/

        before_action -> { require_campaign_role!("board", "chair", "treasurer") }, only: [ :index, :export, :receipt_url ]
        before_action -> { require_campaign_role!("treasurer") }, only: [ :create, :update, :void, :mark_reimbursed ]
        before_action -> { require_campaign_role!("chair", "treasurer") }, only: [ :approve_reimbursement ]
        before_action :require_campaign_writable!, only: [ :create, :update, :void, :approve_reimbursement, :mark_reimbursed ]

        def index
          entries = filtered_entries.includes(
            :budget_line, :campaign_event, :sponsor, :pledge,
            :paid_by_user, :reimbursement_approved_by, :recorded_by, :voided_by
          )

          render json: {
            ledgerEntries: entries.map(&:api_json),
            options: {
              budgetLines: @campaign.budget_lines.active.ordered.map { |l| { id: l.id.to_s, kind: l.kind, category: l.category } },
              events: @campaign.campaign_events.not_archived.ordered.map { |e| { id: e.id.to_s, title: e.title } },
              pledges: @campaign.pledges.active_cash.ordered.map { |p| { id: p.id.to_s, donorName: p.donor_name, status: p.status } },
              sponsors: @campaign.tournament.sponsors.order(:name).map { |s| { id: s.id.to_s, name: s.name } },
              members: @campaign.campaign_memberships.active.includes(:user).map(&:user).compact.uniq(&:id).sort_by(&:email).map { |u| { id: u.id.to_s, fullName: u.full_name, email: u.email } }
            }
          }
        end

        def export
          entries = @campaign.ledger_entries
            .includes(:budget_line, :campaign_event, :sponsor, :pledge, :paid_by_user, :reimbursement_approved_by, :recorded_by, :voided_by)
            .ordered
            .to_a

          csv_body = "\xEF\xBB\xBF" + CSV.generate(headers: true) do |csv|
            csv << [
              "id", "entry_date", "entry_type", "amount_dollars", "source", "payment_method",
              "counterparty", "budget_category", "event", "sponsor", "pledge",
              "description", "reference_number", "paid_by", "reimbursement_status",
              "reimbursed_at", "reimbursement_reference", "has_receipt",
              "recorded_by", "voided", "voided_at", "void_reason"
            ]

            entries.each do |entry|
              csv << [
                entry.id.to_s,
                entry.entry_date&.iso8601,
                escape_csv_text(entry.entry_type),
                format("%d.%02d", entry.amount_cents / 100, entry.amount_cents % 100),
                escape_csv_text(entry.source),
                escape_csv_text(entry.payment_method),
                escape_csv_text(entry.counterparty),
                escape_csv_text(entry.budget_line&.category),
                escape_csv_text(entry.campaign_event&.title),
                escape_csv_text(entry.sponsor&.name),
                escape_csv_text(entry.pledge&.donor_name),
                escape_csv_text(entry.description),
                escape_csv_text(entry.reference_number),
                escape_csv_text(entry.paid_by || entry.paid_by_user&.full_name),
                escape_csv_text(entry.reimbursement_status),
                entry.reimbursed_at&.iso8601,
                escape_csv_text(entry.reimbursement_reference),
                entry.has_receipt? ? "yes" : "no",
                escape_csv_text(entry.recorded_by&.full_name),
                entry.voided? ? "true" : "false",
                entry.voided_at&.iso8601,
                escape_csv_text(entry.void_reason)
              ]
            end
          end

          filename = "#{@campaign.slug}-ledger-#{LedgerEntry.guam_today.iso8601}.csv"
          send_data csv_body,
            filename: filename,
            type: "text/csv; charset=utf-8",
            disposition: "attachment"
        end

        def create
          raw = extract_object_params(:ledgerEntry, :ledger_entry)
          return if performed?

          if supplied_keys_in?(raw, RAW_RECEIPT_PARAM_KEYS)
            return render json: { error: "Direct receipt metadata parameters are not accepted; use receiptUploadToken from /receipts/presign." },
              status: :unprocessable_entity
          end

          attrs = create_entry_params(raw)
          return if performed?

          if attrs[:reimbursement_status].present? && !%w[not_applicable requested].include?(attrs[:reimbursement_status])
            return render json: { error: "New entries can only start with reimbursementStatus 'not_applicable' or 'requested'." },
              status: :unprocessable_entity
          end

          upload_token = extract_receipt_upload_token(raw)
          return if performed?

          verified_receipt = nil
          if upload_token.present?
            verified_receipt = resolve_and_verify_receipt!(upload_token)
            return if performed?
          end

          entry = nil

          LedgerEntry.transaction do
            pledge = nil
            if attrs[:pledge_id].present?
              pledge = @campaign.pledges.lock.find_by(id: attrs[:pledge_id])
              unless pledge
                render json: { errors: [ "Pledge must belong to this campaign" ] }, status: :unprocessable_entity
                raise ActiveRecord::Rollback
              end
            end

            pending = nil
            receipt_attrs = {}
            if verified_receipt
              pending = @campaign.pending_receipt_uploads.lock.find_by(id: verified_receipt[:pending_id], uploaded_by_id: current_user.id)
              unless pending&.attachable? && !LedgerEntry.where(receipt_key: pending.s3_key).exists?
                render json: { error: "Receipt upload token is expired or already used." }, status: :unprocessable_entity
                raise ActiveRecord::Rollback
              end
              receipt_attrs = {
                receipt_key: pending.s3_key,
                receipt_filename: pending.original_filename,
                receipt_content_type: verified_receipt[:content_type],
                receipt_byte_size: verified_receipt[:byte_size]
              }
            end

            entry = @campaign.ledger_entries.build(attrs.merge(receipt_attrs).merge(recorded_by: current_user))
            unless entry.save
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            if pending
              pending.update!(attached_at: Time.current)
              record_audit!(
                record: entry,
                action: "attach_receipt",
                changes: {
                  "receipt_filename" => entry.receipt_filename,
                  "receipt_content_type" => entry.receipt_content_type,
                  "receipt_byte_size" => entry.receipt_byte_size
                }
              )
            end

            pledge&.sync_fulfillment_status!

            record_audit!(
              record: entry,
              action: "create",
              changes: {
                "entry_type" => entry.entry_type,
                "amount_cents" => entry.amount_cents,
                "source" => entry.source,
                "counterparty" => entry.counterparty,
                "pledge_id" => entry.pledge_id,
                "has_receipt" => entry.has_receipt?
              }
            )
          end
          return if performed?

          render json: { ledgerEntry: entry.api_json }, status: :created
        end

        def update
          raw = extract_object_params(:ledgerEntry, :ledger_entry)
          return if performed?

          if supplied_keys_in?(raw, RAW_RECEIPT_PARAM_KEYS)
            return render json: { error: "Direct receipt metadata parameters are not accepted; use receiptUploadToken from /receipts/presign." },
              status: :unprocessable_entity
          end

          immutable_attempted = supplied_keys_in?(raw, IMMUTABLE_UPDATE_KEYS, return_matches: true)
          if immutable_attempted.any?
            return render json: { error: "Core monetary and workflow fields are immutable (#{immutable_attempted.join(', ')}); void and re-enter instead." },
              status: :unprocessable_entity
          end

          entry = @campaign.ledger_entries.find(params[:id])
          if entry.voided?
            return render json: { error: "Voided ledger entries cannot be modified." }, status: :unprocessable_entity
          end

          upload_token = extract_receipt_upload_token(raw)
          return if performed?

          verified_receipt = nil
          if upload_token.present?
            verified_receipt = resolve_and_verify_receipt!(upload_token)
            return if performed?
          end

          LedgerEntry.transaction do
            pending = nil
            receipt_attrs = {}
            if verified_receipt
              pending = @campaign.pending_receipt_uploads.lock.find_by(id: verified_receipt[:pending_id], uploaded_by_id: current_user.id)
              unless pending&.attachable? && !LedgerEntry.where(receipt_key: pending.s3_key).exists?
                render json: { error: "Receipt upload token is expired or already used." }, status: :unprocessable_entity
                raise ActiveRecord::Rollback
              end
              receipt_attrs = {
                receipt_key: pending.s3_key,
                receipt_filename: pending.original_filename,
                receipt_content_type: verified_receipt[:content_type],
                receipt_byte_size: verified_receipt[:byte_size]
              }
            end

            entry.lock!
            if entry.voided?
              render json: { error: "Voided ledger entries cannot be modified." }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            previous_receipt = if entry.has_receipt?
              {
                "receipt_key" => entry.receipt_key,
                "receipt_filename" => entry.receipt_filename,
                "receipt_content_type" => entry.receipt_content_type,
                "receipt_byte_size" => entry.receipt_byte_size
              }
            end

            if pending && previous_receipt && %w[approved reimbursed].include?(entry.reimbursement_status)
              render json: { error: "Cannot replace an attached receipt after reimbursement has been approved or reimbursed; void and re-enter instead." },
                status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            entry.assign_attributes(update_metadata_params(raw).merge(receipt_attrs))
            changes = entry.changes
            unless entry.save
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            if pending
              pending.update!(attached_at: Time.current)
              attach_changes = {
                "receipt_filename" => entry.receipt_filename,
                "receipt_content_type" => entry.receipt_content_type,
                "receipt_byte_size" => entry.receipt_byte_size
              }
              if previous_receipt
                attach_changes["replaced_previous_receipt"] = true
                attach_changes["previous_receipt"] = previous_receipt
              end
              record_audit!(
                record: entry,
                action: "attach_receipt",
                changes: attach_changes
              )
            end

            non_receipt_changes = changes.except("receipt_key", "receipt_filename", "receipt_content_type", "receipt_byte_size")
            if non_receipt_changes.any?
              audit_changes = non_receipt_changes.except("reference_number")
              audit_changes["reference_number_updated"] = true if non_receipt_changes.key?("reference_number")
              record_audit!(record: entry, action: "update", changes: audit_changes)
            end
          end
          return if performed?

          render json: { ledgerEntry: entry.api_json }
        end

        def receipt_url
          entry = @campaign.ledger_entries.find(params[:id])
          unless entry.has_receipt?
            return render json: { error: "No receipt is attached to this ledger entry." }, status: :not_found
          end

          signed = PrivateReceiptStorage.presign_get(
            key: entry.receipt_key,
            filename: entry.receipt_filename,
            content_type: entry.receipt_content_type,
            campaign_id: @campaign.id
          )

          record_audit!(
            record: entry,
            action: "view_receipt",
            changes: { "receipt_filename" => entry.receipt_filename }
          )

          render json: signed.merge(byteSize: entry.receipt_byte_size)
        rescue PrivateReceiptStorage::ConfigurationError => e
          render json: { error: e.message }, status: :service_unavailable
        rescue ArgumentError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        def void
          raw = extract_object_params(:ledgerEntry, :ledger_entry)
          return if performed?

          reason = extract_reason(raw, :voidReason, :void_reason, :reason)
          if reason.blank?
            return render json: { error: "A void reason is required." }, status: :unprocessable_entity
          end

          entry = @campaign.ledger_entries.find(params[:id])

          LedgerEntry.transaction do
            pledge = entry.pledge_id.present? ? @campaign.pledges.lock.find_by(id: entry.pledge_id) : nil
            entry.lock!

            if entry.voided?
              render json: { error: "Ledger entry is already voided." }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            unless entry.update(voided_at: Time.current, voided_by: current_user, void_reason: reason)
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            pledge&.sync_fulfillment_status!

            record_audit!(
              record: entry,
              action: "void",
              changes: { "voided_at" => entry.voided_at.iso8601, "amount_cents" => entry.amount_cents },
              reason: reason
            )
          end
          return if performed?

          render json: { ledgerEntry: entry.api_json }
        end

        def approve_reimbursement
          raw = extract_object_params(:ledgerEntry, :ledger_entry)
          return if performed?

          entry = @campaign.ledger_entries.find(params[:id])
          override_reason = extract_reason(raw, :overrideReason, :override_reason, :reason)

          LedgerEntry.transaction do
            entry.lock!

            if entry.voided? || entry.entry_type != "expense" || entry.reimbursement_status != "requested"
              render json: { error: "Only live expense entries with requested reimbursement can be approved." }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            if entry.paid_by_user_id.present? && entry.paid_by_user_id == current_user.id
              render_forbidden("You cannot approve your own reimbursement.")
              raise ActiveRecord::Rollback
            end

            if entry.recorded_by_id == current_user.id
              unless current_user.admin? && override_reason.present?
                render_forbidden("A second officer must approve a reimbursement you recorded.")
                raise ActiveRecord::Rollback
              end
            end

            unless entry.update(reimbursement_status: "approved", reimbursement_approved_by: current_user)
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            record_audit!(
              record: entry,
              action: "approve_reimbursement",
              changes: { "reimbursement_status" => "approved", "reimbursement_approved_by_id" => current_user.id },
              reason: override_reason
            )
          end
          return if performed?

          render json: { ledgerEntry: entry.api_json }
        end

        def mark_reimbursed
          raw = extract_object_params(:ledgerEntry, :ledger_entry)
          return if performed?

          entry = @campaign.ledger_entries.find(params[:id])
          raw_reimbursed_at = if params.key?(:reimbursedAt) || params.key?(:reimbursed_at)
            params.key?(:reimbursedAt) ? params[:reimbursedAt] : params[:reimbursed_at]
          elsif raw.key?(:reimbursedAt) || raw.key?(:reimbursed_at)
            raw.key?(:reimbursedAt) ? raw[:reimbursedAt] : raw[:reimbursed_at]
          end

          ok, parsed_date_or_err = parse_strict_iso_date(raw_reimbursed_at, field_label: "reimbursedAt")
          unless ok
            return render json: { error: parsed_date_or_err }, status: :unprocessable_entity
          end
          reimbursed_at = parsed_date_or_err || LedgerEntry.guam_today

          reference = (
            params[:reimbursementReference].presence || params[:reimbursement_reference].presence ||
            raw[:reimbursementReference].presence || raw[:reimbursement_reference].presence
          )&.to_s&.strip

          LedgerEntry.transaction do
            entry.lock!

            if entry.voided? || entry.entry_type != "expense" || entry.reimbursement_status != "approved"
              render json: { error: "Only approved live expense reimbursements can be marked reimbursed." }, status: :unprocessable_entity
              raise ActiveRecord::Rollback
            end

            unless entry.update(
              reimbursement_status: "reimbursed",
              reimbursed_at: reimbursed_at,
              reimbursement_reference: reference
            )
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            record_audit!(
              record: entry,
              action: "mark_reimbursed",
              changes: {
                "reimbursement_status" => "reimbursed",
                "reimbursed_at" => entry.reimbursed_at&.iso8601,
                "has_reimbursement_reference" => entry.reimbursement_reference.present?
              }
            )
          end
          return if performed?

          render json: { ledgerEntry: entry.api_json }
        end

        private

        def filtered_entries
          scope = @campaign.ledger_entries.ordered
          scope = scope.live unless ActiveModel::Type::Boolean.new.cast(params[:includeVoided])
          scope = scope.where(entry_type: params[:entryType]) if params[:entryType].present?
          scope = scope.where(source: params[:source]) if params[:source].present?
          scope = scope.where(payment_method: params[:paymentMethod]) if params[:paymentMethod].present?
          scope = scope.where(reimbursement_status: params[:reimbursementStatus]) if params[:reimbursementStatus].present?
          scope = scope.where(budget_line_id: params[:budgetLineId]) if params[:budgetLineId].present?
          scope = scope.where(campaign_event_id: params[:campaignEventId]) if params[:campaignEventId].present?
          scope = scope.where(pledge_id: params[:pledgeId]) if params[:pledgeId].present?
          scope
        end

        def supplied_keys_in?(raw, target_keys, return_matches: false)
          raw_keys = raw.to_unsafe_h.keys.map(&:to_s)
          top_keys = params.to_unsafe_h.keys.map(&:to_s)
          matches = (raw_keys | top_keys) & target_keys
          return_matches ? matches : matches.any?
        end

        def extract_reason(raw, *keys)
          keys.each do |k|
            val = params[k].presence || raw[k].presence
            return val.to_s.strip if val.present?
          end
          nil
        end

        def extract_receipt_upload_token(raw)
          token_val = if params.key?(:receiptUploadToken)
            params[:receiptUploadToken]
          elsif params.key?(:receipt_upload_token)
            params[:receipt_upload_token]
          elsif raw.key?(:receiptUploadToken)
            raw[:receiptUploadToken]
          elsif raw.key?(:receipt_upload_token)
            raw[:receipt_upload_token]
          end
          return nil if token_val.nil?

          unless token_val.is_a?(String)
            render json: { error: "receiptUploadToken must be a string." }, status: :unprocessable_entity
            return nil
          end

          token_val.strip.presence
        end

        def resolve_and_verify_receipt!(upload_token)
          pending = @campaign.pending_receipt_uploads.attachable.find_by(
            upload_token: upload_token,
            uploaded_by_id: current_user.id
          )
          unless pending
            render json: { error: "Receipt upload token is invalid, expired, or belongs to another campaign." },
              status: :unprocessable_entity
            return nil
          end

          if LedgerEntry.where(receipt_key: pending.s3_key).exists?
            render json: { error: "Receipt has already been attached to a ledger entry." },
              status: :unprocessable_entity
            return nil
          end

          verified = PrivateReceiptStorage.verify_object(
            key: pending.s3_key,
            expected_content_type: pending.expected_content_type,
            campaign_id: @campaign.id
          )

          {
            pending_id: pending.id,
            content_type: verified[:contentType],
            byte_size: verified[:byteSize]
          }
        rescue PrivateReceiptStorage::ConfigurationError => e
          render json: { error: e.message }, status: :service_unavailable
          nil
        rescue PrivateReceiptStorage::VerificationError => e
          render json: { error: e.message }, status: :unprocessable_entity
          nil
        end

        def create_entry_params(raw)
          permitted = raw.permit(
            :entry_type, :entryType,
            :amount_cents, :amountCents,
            :entry_date, :entryDate,
            :budget_line_id, :budgetLineId,
            :campaign_event_id, :campaignEventId,
            :sponsor_id, :sponsorId,
            :pledge_id, :pledgeId,
            :source,
            :payment_method, :paymentMethod,
            :counterparty,
            :description,
            :reference_number, :referenceNumber,
            :paid_by, :paidBy,
            :paid_by_user_id, :paidByUserId,
            :reimbursement_status, :reimbursementStatus
          )

          attrs = {}
          assign_param(attrs, permitted, :entry_type, :entry_type, :entryType)
          assign_param(attrs, permitted, :amount_cents, :amount_cents, :amountCents)
          if permitted.key?(:entry_date) || permitted.key?(:entryDate)
            raw_date = permitted.key?(:entry_date) ? permitted[:entry_date] : permitted[:entryDate]
            ok, parsed_or_err = parse_strict_iso_date(raw_date, field_label: "entryDate")
            unless ok
              render json: { error: parsed_or_err }, status: :unprocessable_entity
              return {}
            end
            attrs[:entry_date] = parsed_or_err if parsed_or_err
          end
          assign_param(attrs, permitted, :budget_line_id, :budget_line_id, :budgetLineId)
          assign_param(attrs, permitted, :campaign_event_id, :campaign_event_id, :campaignEventId)
          assign_param(attrs, permitted, :sponsor_id, :sponsor_id, :sponsorId)
          assign_param(attrs, permitted, :pledge_id, :pledge_id, :pledgeId)
          assign_param(attrs, permitted, :source, :source)
          assign_param(attrs, permitted, :payment_method, :payment_method, :paymentMethod)
          assign_param(attrs, permitted, :counterparty, :counterparty)
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :reference_number, :reference_number, :referenceNumber)
          assign_param(attrs, permitted, :paid_by, :paid_by, :paidBy)
          assign_param(attrs, permitted, :paid_by_user_id, :paid_by_user_id, :paidByUserId)
          if permitted.key?(:reimbursement_status) || permitted.key?(:reimbursementStatus)
            attrs[:reimbursement_status] = (permitted[:reimbursement_status] || permitted[:reimbursementStatus]).to_s.strip.downcase
          end
          attrs
        end

        def update_metadata_params(raw)
          permitted = raw.permit(
            :description,
            :reference_number, :referenceNumber,
            :budget_line_id, :budgetLineId,
            :campaign_event_id, :campaignEventId,
            :sponsor_id, :sponsorId
          )

          attrs = {}
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :reference_number, :reference_number, :referenceNumber)
          assign_param(attrs, permitted, :budget_line_id, :budget_line_id, :budgetLineId)
          assign_param(attrs, permitted, :campaign_event_id, :campaign_event_id, :campaignEventId)
          assign_param(attrs, permitted, :sponsor_id, :sponsor_id, :sponsorId)
          attrs
        end

        def escape_csv_text(value)
          return "" if value.nil?

          text = value.to_s
          return "" if text.empty?

          text.match?(CSV_FORMULA_REGEX) ? "'#{text}" : text
        end
      end
    end
  end
end
