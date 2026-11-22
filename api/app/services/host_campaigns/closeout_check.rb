module HostCampaigns
  class CloseoutCheck
    def self.call(campaign)
      new(campaign).call
    end

    def initialize(campaign)
      @campaign = campaign
      @tournament = campaign.tournament
    end

    def call
      live_entries = @campaign.ledger_entries.live
      live_expenses = live_entries.where(entry_type: "expense")

      pending_reimbursements_count = live_expenses
        .where(reimbursement_status: %w[requested approved])
        .count
      missing_receipts_count = live_expenses
        .where(receipt_key: [ nil, "" ])
        .count
      open_cash_pledges_count = @campaign.pledges
        .active_cash
        .where(status: %w[promised partial])
        .count

      unfinalized_games_count = if @tournament
        @tournament.games
          .where.not(status: %w[final cancelled])
          .where(placeholder: false)
          .count
      else
        0
      end

      champions_recorded_count = if @tournament
        TournamentChampion.for_tournament(@tournament)
          .completed
          .distinct
          .count
      else
        0
      end

      blockers = []
      if pending_reimbursements_count.positive?
        blockers << {
          code: "pending_reimbursements",
          message: "#{pending_reimbursements_count} reimbursement #{pending_reimbursements_count == 1 ? 'request is' : 'requests are'} still pending approval or payout.",
          count: pending_reimbursements_count
        }
      end
      if unfinalized_games_count.positive?
        blockers << {
          code: "unfinalized_games",
          message: "#{unfinalized_games_count} non-placeholder tournament #{unfinalized_games_count == 1 ? 'game is' : 'games are'} not yet final or cancelled.",
          count: unfinalized_games_count
        }
      end

      warnings = []
      if missing_receipts_count.positive?
        warnings << {
          code: "missing_receipts",
          message: "#{missing_receipts_count} live expense #{missing_receipts_count == 1 ? 'entry is' : 'entries are'} missing a receipt attachment.",
          count: missing_receipts_count
        }
      end
      if open_cash_pledges_count.positive?
        warnings << {
          code: "open_cash_pledges",
          message: "#{open_cash_pledges_count} cash #{open_cash_pledges_count == 1 ? 'pledge is' : 'pledges are'} still marked promised or partial.",
          count: open_cash_pledges_count
        }
      end
      if champions_recorded_count.zero?
        warnings << {
          code: "missing_champions",
          message: "No completed tournament champion record has been logged for #{@tournament&.year || 'this year'} yet.",
          count: 0
        }
      end

      {
        campaignId: @campaign.id.to_s,
        status: @campaign.status,
        unfinalizedGamesCount: unfinalized_games_count,
        pendingReimbursementsCount: pending_reimbursements_count,
        openCashPledgesCount: open_cash_pledges_count,
        missingReceiptsCount: missing_receipts_count,
        championsRecordedCount: champions_recorded_count,
        liveExpensesCount: live_expenses.count,
        voidedEntriesCount: @campaign.ledger_entries.voided.count,
        auditEventsCount: @campaign.finance_audit_events.count,
        blockers: blockers,
        warnings: warnings,
        ready: blockers.empty?
      }
    end
  end
end
