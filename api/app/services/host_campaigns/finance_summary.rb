module HostCampaigns
  class FinanceSummary
    class << self
      def public_meter_totals(campaign)
        income_scope = campaign.ledger_entries.where(entry_type: "income")
        income_scope = income_scope.where.not(source: LedgerEntry::FDAA_SOURCES) unless campaign.include_fdaa_in_public_meter?
        raised = income_scope.live.sum(:amount_cents).to_i
        latest_update = [ campaign.updated_at, income_scope.maximum(:updated_at) ].compact.max
        { raised_cents: raised, updated_at: latest_update }
      end

      def call(campaign)
        live_entries = campaign.ledger_entries.live

        raised_cents = live_entries.where(entry_type: "income").sum(:amount_cents).to_i
        raised_excluding_fdaa_cents = live_entries
          .where(entry_type: "income")
          .where.not(source: LedgerEntry::FDAA_SOURCES)
          .sum(:amount_cents).to_i
        spent_cents = live_entries.where(entry_type: "expense").sum(:amount_cents).to_i
        net_cents = raised_cents - spent_cents
        public_meter_raised_cents = campaign.include_fdaa_in_public_meter? ? raised_cents : raised_excluding_fdaa_cents
        still_needed_cents = [ campaign.goal_cents - public_meter_raised_cents, 0 ].max
        still_needed_gross_cents = [ campaign.goal_cents - raised_cents, 0 ].max

        pledge_received_by_id = live_entries
          .where(entry_type: "income")
          .where.not(pledge_id: nil)
          .group(:pledge_id)
          .sum(:amount_cents)

        cash_pledges = campaign.pledges.active_cash.to_a
        pledged_total_cents = cash_pledges.sum(&:promised_cents)
        pledged_received_cents = cash_pledges.sum { |p| pledge_received_by_id[p.id].to_i }
        outstanding_pledges_cents = cash_pledges.sum { |p| [ p.promised_cents - pledge_received_by_id[p.id].to_i, 0 ].max }
        in_kind_pledges_count = campaign.pledges.where(is_in_kind: true).where.not(status: "cancelled").count

        pending_reimb_scope = live_entries
          .where(entry_type: "expense", reimbursement_status: %w[requested approved])
        pending_reimbursements_cents = pending_reimb_scope.sum(:amount_cents).to_i
        pending_reimbursements_count = pending_reimb_scope.count

        by_source = live_entries.group(:entry_type, :source).sum(:amount_cents).map do |(entry_type, source), cents|
          { entryType: entry_type, source: source, amountCents: cents.to_i }
        end.sort_by { |row| [ row[:entryType], -row[:amountCents], row[:source] ] }

        by_method = live_entries.group(:entry_type, :payment_method).sum(:amount_cents).map do |(entry_type, payment_method), cents|
          { entryType: entry_type, paymentMethod: payment_method, amountCents: cents.to_i }
        end.sort_by { |row| [ row[:entryType], -row[:amountCents], row[:paymentMethod] ] }

        actual_by_budget_line = live_entries.where.not(budget_line_id: nil).group(:budget_line_id).sum(:amount_cents)
        referenced_ids = actual_by_budget_line.keys
        budget_lines = campaign.budget_lines
          .where("archived_at IS NULL OR id IN (?)", referenced_ids.presence || [ -1 ])
          .ordered
          .to_a

        budget_vs_actual = budget_lines.map do |line|
          actual = actual_by_budget_line[line.id].to_i
          {
            id: line.id.to_s,
            kind: line.kind,
            category: line.category,
            budgetCents: line.budget_cents,
            actualCents: actual,
            varianceCents: actual - line.budget_cents,
            archived: line.archived?
          }
        end

        mixed_net_event_ids = find_mixed_net_event_ids(live_entries)

        {
          goalCents: campaign.goal_cents,
          raisedCents: raised_cents,
          raisedExcludingFdaaCents: raised_excluding_fdaa_cents,
          spentCents: spent_cents,
          netCents: net_cents,
          stillNeededCents: still_needed_cents,
          stillNeededGrossCents: still_needed_gross_cents,
          publicMeterRaisedCents: public_meter_raised_cents,
          publicMeterEnabled: campaign.public_meter_enabled,
          includeFdaaInPublicMeter: campaign.include_fdaa_in_public_meter,
          fdaaUpfrontCents: campaign.fdaa_upfront_cents,
          fdaaTicketShareBps: campaign.fdaa_ticket_share_bps,
          pledgedTotalCents: pledged_total_cents,
          pledgedReceivedCents: pledged_received_cents,
          outstandingPledgesCents: outstanding_pledges_cents,
          inKindPledgesCount: in_kind_pledges_count,
          pendingReimbursementsCents: pending_reimbursements_cents,
          pendingReimbursementsCount: pending_reimbursements_count,
          bySource: by_source,
          byMethod: by_method,
          budgetVsActual: budget_vs_actual,
          mixedNetEventIds: mixed_net_event_ids
        }
      end

      private

      def find_mixed_net_event_ids(live_entries)
        net_event_ids = live_entries
          .where(entry_type: "income", source: %w[fundraiser_net golf_net])
          .where.not(campaign_event_id: nil)
          .distinct
          .pluck(:campaign_event_id)
        return [] if net_event_ids.empty?

        live_entries
          .where(entry_type: "expense", source: "event_expense", campaign_event_id: net_event_ids)
          .distinct
          .pluck(:campaign_event_id)
          .map(&:to_s)
      end
    end
  end
end
