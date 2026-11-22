require "test_helper"
require "csv"

class CampaignFinanceControllerTest < ActionDispatch::IntegrationTest
  setup do
    @cohort_2017 = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "'17")
    @cohort_2018 = ClassCohort.create!(key: "18", graduation_year: 2018, display_name: "Class of 2018", short_label: "'18")
    @tournament_2027 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "upcoming"
    )
    @tournament_2028 = Tournament.create!(
      name: "FD Alumni Basketball Tournament",
      year: 2028,
      start_date: Date.new(2028, 6, 24),
      end_date: Date.new(2028, 7, 15),
      status: "upcoming"
    )

    @campaign = HostCampaign.create!(
      tournament: @tournament_2027,
      class_cohort: @cohort_2017,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      status: "active",
      featured: true,
      goal_cents: 3_000_000,
      fdaa_upfront_cents: 1_500_000,
      fdaa_ticket_share_bps: 5000,
      public_meter_enabled: false,
      include_fdaa_in_public_meter: false
    )
    @other_campaign = HostCampaign.create!(
      tournament: @tournament_2028,
      class_cohort: @cohort_2018,
      slug: "2028-class-of-2018",
      title: "Class of 2018 Host Year",
      status: "draft",
      featured: false,
      goal_cents: 2_500_000
    )

    @sponsor_2027 = Sponsor.create!(tournament: @tournament_2027, name: "Bank of Guam", position: 1)
    @sponsor_2028 = Sponsor.create!(tournament: @tournament_2028, name: "Other Year Sponsor", position: 1)
    @event_2027 = @campaign.campaign_events.create!(kind: "fundraiser", title: "Antigu Night", status: "open")
    @other_event = @other_campaign.campaign_events.create!(kind: "fundraiser", title: "2028 Event", status: "planned")

    @admin = User.create!(email: "admin@example.com", clerk_id: "clerk_admin", role: "admin", first_name: "Leon", last_name: "Admin")
    @staff = User.create!(email: "staff@example.com", clerk_id: "clerk_staff", role: "staff", first_name: "Staff", last_name: "User")
    @chair = User.create!(email: "chair@example.com", clerk_id: "clerk_chair", role: "viewer", first_name: "Kami", last_name: "Chair")
    @treasurer = User.create!(email: "treasurer@example.com", clerk_id: "clerk_treasurer", role: "viewer", first_name: "Ryan", last_name: "Treasurer")
    @treasurer2 = User.create!(email: "treasurer2@example.com", clerk_id: "clerk_treasurer2", role: "viewer", first_name: "Mike", last_name: "CoTreasurer")
    @board = User.create!(email: "board@example.com", clerk_id: "clerk_board", role: "viewer", first_name: "Pat", last_name: "Board")

    CampaignMembership.create!(host_campaign: @campaign, user: @chair, role: "chair", active: true)
    CampaignMembership.create!(host_campaign: @campaign, user: @treasurer, role: "treasurer", active: true)
    CampaignMembership.create!(host_campaign: @campaign, user: @treasurer2, role: "treasurer", active: true)
    CampaignMembership.create!(host_campaign: @campaign, user: @board, role: "board", active: true)
  end

  test "enforces RBAC and Cache-Control: no-store across finance endpoints" do
    # Anonymous -> 401
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary"
    assert_response :unauthorized

    # Staff without campaign membership -> 403
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary", headers: auth_headers(@staff)
    assert_response :forbidden

    # Board can read summary, budget lines, pledges, ledger, audit events, and CSV export with no-store
    %w[
      finance/summary
      finance/audit-events
      budget-lines
      pledges
      ledger-entries
      ledger-entries/export.csv
    ].each do |path|
      get "/api/v1/campaign/#{@campaign.slug}/#{path}", headers: auth_headers(@board)
      assert_response :success, "Board should be able to GET #{path}"
      assert_equal "no-store", response.headers["Cache-Control"]
    end

    # Board and chair cannot write budget lines, pledges, or ledger entries
    [ @board, @chair ].each do |user|
      post "/api/v1/campaign/#{@campaign.slug}/budget-lines",
        params: { budgetLine: { kind: "income", category: "Fundraisers", budgetCents: 500_000 } },
        headers: auth_headers(user), as: :json
      assert_response :forbidden

      post "/api/v1/campaign/#{@campaign.slug}/pledges",
        params: { pledge: { donorName: "Donor", promisedCents: 100_000 } },
        headers: auth_headers(user), as: :json
      assert_response :forbidden

      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
        params: { ledgerEntry: { entryType: "income", amountCents: 10_000, source: "donation", paymentMethod: "cash", counterparty: "Donor" } },
        headers: auth_headers(user), as: :json
      assert_response :forbidden
    end
  end

  test "budget lines support CRUD, case-insensitive uniqueness, soft-archive, and budgetVsActual inclusion" do
    post "/api/v1/campaign/#{@campaign.slug}/budget-lines",
      params: { budgetLine: { kind: "income", category: "Fundraisers", budgetCents: 1_000_000 } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    line_id = JSON.parse(response.body).dig("budgetLine", "id")

    # Duplicate active category (case-insensitive) fails
    post "/api/v1/campaign/#{@campaign.slug}/budget-lines",
      params: { budgetLine: { kind: "income", category: "fundraisers", budgetCents: 200_000 } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Link a live income entry, then archive the budget line
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: {
        ledgerEntry: {
          entryType: "income",
          amountCents: 250_000,
          source: "fundraiser_gross",
          paymentMethod: "cash",
          counterparty: "Antigu Door",
          budgetLineId: line_id,
          campaignEventId: @event_2027.id
        }
      },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created

    post "/api/v1/campaign/#{@campaign.slug}/budget-lines/#{line_id}/archive", headers: auth_headers(@treasurer)
    assert_response :success
    assert JSON.parse(response.body).dig("budgetLine", "archivedAt").present?

    # Archived line with live entries still appears in budgetVsActual with actualCents
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary", headers: auth_headers(@board)
    assert_response :success
    summary = JSON.parse(response.body).fetch("summary")
    row = summary.fetch("budgetVsActual").find { |r| r["id"] == line_id }
    assert_not_nil row
    assert_equal true, row["archived"]
    assert_equal 250_000, row["actualCents"]
  end

  test "pledge lifecycle auto-syncs partial/fulfilled/overpayment, reverses on void, excludes in-kind from cash totals, and rejects cancelled pledges" do
    post "/api/v1/campaign/#{@campaign.slug}/pledges",
      params: { pledge: { donorName: "Bank of Guam", sponsorId: @sponsor_2027.id, tier: "Diamond", promisedCents: 500_000 } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    pledge_id = JSON.parse(response.body).dig("pledge", "id")

    post "/api/v1/campaign/#{@campaign.slug}/pledges",
      params: { pledge: { donorName: "In-Kind Printing", tier: "In-Kind", isInKind: true, promisedCents: 200_000 } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    in_kind_id = JSON.parse(response.body).dig("pledge", "id")

    post "/api/v1/campaign/#{@campaign.slug}/pledges",
      params: { pledge: { donorName: "Cancelled Donor", promisedCents: 100_000, status: "cancelled" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    cancelled_id = JSON.parse(response.body).dig("pledge", "id")

    # Reject linking income to cancelled or in-kind pledge
    [ cancelled_id, in_kind_id ].each do |bad_pledge_id|
      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
        params: { ledgerEntry: { entryType: "income", amountCents: 50_000, source: "sponsorship", paymentMethod: "check", counterparty: "Donor", pledgeId: bad_pledge_id } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :unprocessable_entity
    end

    # Partial payment -> status partial
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 200_000, source: "sponsorship", paymentMethod: "check", counterparty: "Bank of Guam", pledgeId: pledge_id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    entry1_id = JSON.parse(response.body).dig("ledgerEntry", "id")
    assert_equal "partial", Pledge.find(pledge_id).status

    # Second payment overpays ($600k vs $500k) -> fulfilled, overpayment 100k, outstanding 0
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 400_000, source: "sponsorship", paymentMethod: "check", counterparty: "Bank of Guam", pledgeId: pledge_id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    entry2_id = JSON.parse(response.body).dig("ledgerEntry", "id")

    get "/api/v1/campaign/#{@campaign.slug}/pledges", headers: auth_headers(@board)
    pledge_json = JSON.parse(response.body).fetch("pledges").find { |p| p["id"] == pledge_id }
    assert_equal "fulfilled", pledge_json["status"]
    assert_equal 600_000, pledge_json["receivedCents"]
    assert_equal 0, pledge_json["outstandingCents"]
    assert_equal 100_000, pledge_json["overpaymentCents"]

    # Cannot cancel pledge with live income
    patch "/api/v1/campaign/#{@campaign.slug}/pledges/#{pledge_id}",
      params: { pledge: { status: "cancelled" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Summary excludes in-kind pledge from cash pledgedTotalCents
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary", headers: auth_headers(@board)
    summary = JSON.parse(response.body).fetch("summary")
    assert_equal 500_000, summary["pledgedTotalCents"]
    assert_equal 1, summary["inKindPledgesCount"]

    # Voiding entry2 drops pledge status back to partial
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry2_id}/void",
      params: { voidReason: "Duplicate check entry" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :success
    assert_equal "partial", Pledge.find(pledge_id).status

    # Voiding entry1 drops pledge status back to promised
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry1_id}/void",
      params: { voidReason: "Check bounced" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :success
    assert_equal "promised", Pledge.find(pledge_id).status
  end

  test "enforces immutable fields, receipt rejection until A3.2, cross-campaign ID rejection, and void-only lifecycle" do
    other_budget_line = @other_campaign.budget_lines.create!(kind: "income", category: "Other", budget_cents: 100_000)
    expense_budget_line = @campaign.budget_lines.create!(kind: "expense", category: "Venue", budget_cents: 100_000)

    # Receipt params rejected until A3.2
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "expense", amountCents: 10_000, source: "event_expense", paymentMethod: "cash", counterparty: "Store", receiptKey: "receipts/1/a.jpg" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Cross-campaign budget_line, event, and wrong-tournament sponsor rejected
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 10_000, source: "donation", paymentMethod: "cash", counterparty: "Donor", budgetLineId: other_budget_line.id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 10_000, source: "donation", paymentMethod: "cash", counterparty: "Donor", campaignEventId: @other_event.id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 10_000, source: "sponsorship", paymentMethod: "check", counterparty: "Donor", sponsorId: @sponsor_2028.id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Mismatched budget line kind rejected
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 10_000, source: "donation", paymentMethod: "cash", counterparty: "Donor", budgetLineId: expense_budget_line.id } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Valid create defaults entry_date to Guam today
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: { ledgerEntry: { entryType: "income", amountCents: 12_500, source: "donation", paymentMethod: "paypal", counterparty: "Alumnus" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    created = JSON.parse(response.body).fetch("ledgerEntry")
    assert_equal LedgerEntry.guam_today.iso8601, created["entryDate"]

    # Hard delete blocked at model level
    record = LedgerEntry.find(created["id"])
    assert_not record.destroy

    # Immutable field rejected on PATCH
    patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}",
      params: { ledgerEntry: { amountCents: 99_999 } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Allowed metadata update succeeds and logs audit event
    patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}",
      params: { ledgerEntry: { description: "Added memo", referenceNumber: "PP-123" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :success
    assert_equal "Added memo", JSON.parse(response.body).dig("ledgerEntry", "description")

    # Void requires reason
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}/void",
      params: { voidReason: "   " },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}/void",
      params: { voidReason: "Entered wrong amount" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :success

    # Voided entry cannot be updated or voided again
    patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}",
      params: { ledgerEntry: { description: "Late edit" } },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{record.id}/void",
      params: { voidReason: "Again" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity
  end

  test "enforces separation of duties on reimbursements (payer blocked, recorder blocked without admin override, second officer approves)" do
    # Treasurer pays out of pocket and records expense
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: {
        ledgerEntry: {
          entryType: "expense",
          amountCents: 45_000,
          source: "event_expense",
          paymentMethod: "card",
          counterparty: "Cost-U-Less",
          paidBy: "Ryan Treasurer",
          paidByUserId: @treasurer.id,
          reimbursementStatus: "requested"
        }
      },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    reimb_id = JSON.parse(response.body).dig("ledgerEntry", "id")

    # Cannot jump directly to reimbursed before approval
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/mark-reimbursed",
      params: { reimbursementReference: "CHK-1" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :unprocessable_entity

    # Payer cannot self-approve -> 403
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/approve-reimbursement",
      headers: auth_headers(@treasurer), as: :json
    assert_response :forbidden

    # Board cannot approve -> 403
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/approve-reimbursement",
      headers: auth_headers(@board), as: :json
    assert_response :forbidden

    # Chair (second officer) approves -> 200
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/approve-reimbursement",
      headers: auth_headers(@chair), as: :json
    assert_response :success
    assert_equal "approved", JSON.parse(response.body).dig("ledgerEntry", "reimbursementStatus")

    # Chair cannot mark reimbursed -> 403; Treasurer marks reimbursed -> 200
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/mark-reimbursed",
      headers: auth_headers(@chair), as: :json
    assert_response :forbidden

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{reimb_id}/mark-reimbursed",
      params: { reimbursementReference: "CHK-402" },
      headers: auth_headers(@treasurer), as: :json
    assert_response :success
    reimbursed = JSON.parse(response.body).fetch("ledgerEntry")
    assert_equal "reimbursed", reimbursed["reimbursementStatus"]
    assert_equal "CHK-402", reimbursed["reimbursementReference"]

    # Expense without paid_by_user_id: recorder cannot self-approve; second treasurer CAN approve
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
      params: {
        ledgerEntry: {
          entryType: "expense",
          amountCents: 15_000,
          source: "venue_ops",
          paymentMethod: "cash",
          counterparty: "Ice Vendor",
          paidBy: "External Volunteer",
          reimbursementStatus: "requested"
        }
      },
      headers: auth_headers(@treasurer), as: :json
    assert_response :created
    no_user_reimb_id = JSON.parse(response.body).dig("ledgerEntry", "id")

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{no_user_reimb_id}/approve-reimbursement",
      headers: auth_headers(@treasurer), as: :json
    assert_response :forbidden

    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{no_user_reimb_id}/approve-reimbursement",
      headers: auth_headers(@treasurer2), as: :json
    assert_response :success
  end

  test "CSV export escapes formula text cells only, preserves numeric amounts, includes voided rows, and sets no-store" do
    LedgerEntry.create!(
      host_campaign: @campaign,
      entry_type: "income",
      amount_cents: 12_500,
      source: "donation",
      payment_method: "cash",
      counterparty: "=SUM(A1:A5)",
      description: "+cmd|' /C calc'!A0",
      recorded_by: @treasurer
    )
    LedgerEntry.create!(
      host_campaign: @campaign,
      entry_type: "expense",
      amount_cents: 5_000,
      source: "event_expense",
      payment_method: "cash",
      counterparty: "@evil",
      recorded_by: @treasurer,
      voided_at: Time.current,
      voided_by: @treasurer,
      void_reason: "-mistake"
    )

    get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/export.csv", headers: auth_headers(@board)
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    assert response.body.b.start_with?("\xEF\xBB\xBF".b), "CSV must start with UTF-8 BOM"

    csv_text = response.body.force_encoding("UTF-8").delete_prefix("\uFEFF")
    rows = CSV.parse(csv_text, headers: true)
    assert_equal 2, rows.length

    income_row = rows.find { |r| r["entry_type"] == "income" }
    assert_equal "125.00", income_row["amount_dollars"]
    assert_equal "'=SUM(A1:A5)", income_row["counterparty"]
    assert_equal "'+cmd|' /C calc'!A0", income_row["description"]
    assert_equal "false", income_row["voided"]
    assert_equal "no", income_row["has_receipt"]

    void_row = rows.find { |r| r["entry_type"] == "expense" }
    assert_equal "50.00", void_row["amount_dollars"]
    assert_equal "'@evil", void_row["counterparty"]
    assert_equal "true", void_row["voided"]
    assert_equal "'-mistake", void_row["void_reason"]
  end

  test "public host-year meter uses real ledger totals, respects FDAA toggle, hides expenses, and filters sensitive params" do
    LedgerEntry.create!(
      host_campaign: @campaign,
      entry_type: "income",
      amount_cents: 600_000,
      source: "fundraiser_net",
      payment_method: "hafapass_payout",
      counterparty: "Antigu Night",
      campaign_event: @event_2027,
      recorded_by: @treasurer
    )
    LedgerEntry.create!(
      host_campaign: @campaign,
      entry_type: "income",
      amount_cents: 1_500_000,
      source: "fdaa_allocation",
      payment_method: "fdaa",
      counterparty: "FDAA",
      recorded_by: @treasurer
    )
    LedgerEntry.create!(
      host_campaign: @campaign,
      entry_type: "expense",
      amount_cents: 100_000,
      source: "event_expense",
      payment_method: "cash",
      counterparty: "DJ",
      campaign_event: @event_2027,
      recorded_by: @treasurer
    )

    # Meter disabled -> strictly { enabled: false }
    get "/api/v1/public/host-year"
    assert_response :success
    assert_equal({ "enabled" => false }, JSON.parse(response.body).dig("campaign", "meter"))

    # Meter enabled, FDAA excluded -> 600_000 of 3_000_000 (20.0%)
    @campaign.update!(public_meter_enabled: true, include_fdaa_in_public_meter: false)
    get "/api/v1/public/host-year"
    meter = JSON.parse(response.body).dig("campaign", "meter")
    assert_equal true, meter["enabled"]
    assert_equal 600_000, meter["raisedCents"]
    assert_equal 3_000_000, meter["goalCents"]
    assert_equal 20.0, meter["percent"]
    assert_nil JSON.parse(response.body).dig("campaign", "spentCents")

    # Include FDAA -> 2_100_000 of 3_000_000 (70.0%)
    @campaign.update!(include_fdaa_in_public_meter: true)
    get "/api/v1/public/host-year"
    meter = JSON.parse(response.body).dig("campaign", "meter")
    assert_equal 2_100_000, meter["raisedCents"]
    assert_equal 70.0, meter["percent"]

    # Mixed net + event_expense warning detected in summary
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary", headers: auth_headers(@board)
    summary = JSON.parse(response.body).fetch("summary")
    assert_includes summary["mixedNetEventIds"], @event_2027.id.to_s

    # Sensitive finance fields are filtered by ParameterFilter
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    filtered = filter.filter(
      contact_info: "671-555-0101",
      receipt_key: "receipts/1/secret.pdf",
      reference_number: "CHK-999",
      reimbursement_reference: "ACH-888"
    )
    filtered.each do |key, val|
      assert_equal "[FILTERED]", val, "Expected #{key} to be filtered from logs"
    end
  end

  private

  def auth_headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
