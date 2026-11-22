require "test_helper"

class CampaignCloseoutAndCloneTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "c1-admin@example.com", clerk_id: "clerk_c1_admin", role: "admin", first_name: "Lead", last_name: "Admin")
    @staff = User.create!(email: "c1-staff@example.com", clerk_id: "clerk_c1_staff", role: "staff")
    @board = User.create!(email: "c1-board@example.com", clerk_id: "clerk_c1_board", role: "viewer", first_name: "Board", last_name: "Member")
    @outsider = User.create!(email: "c1-out@example.com", clerk_id: "clerk_c1_out", role: "viewer")

    @tournament = Tournament.create!(
      name: "FD Alumni Basketball Tournament 2027",
      year: 2027,
      start_date: Date.new(2027, 6, 25),
      end_date: Date.new(2027, 7, 16),
      status: "live"
    )
    @maroon = @tournament.divisions.create!(name: "Maroon", slug: "maroon", position: 1, counts_for_standings: true)
    @special = @tournament.divisions.create!(name: "Special", slug: "special", position: 2, counts_for_standings: false)
    @inactive_div = @tournament.divisions.create!(name: "Old", slug: "old", position: 3, active: false)

    @team_a = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: @maroon)
    @team_b = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: @maroon)

    @final_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "pool",
      start_time: Time.zone.local(2027, 6, 25, 19, 0),
      status: "final",
      home_score: 75,
      away_score: 68
    )
    @cancelled_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "pool",
      start_time: Time.zone.local(2027, 6, 26, 19, 0),
      status: "cancelled"
    )
    @placeholder_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "playoff",
      start_time: Time.zone.local(2027, 7, 15, 19, 0),
      status: "scheduled",
      placeholder: true
    )
    @open_game = @tournament.games.create!(
      home_team: @team_a,
      away_team: @team_b,
      division_record: @maroon,
      phase: "pool",
      start_time: Time.zone.local(2027, 6, 27, 19, 0),
      status: "scheduled",
      placeholder: false
    )

    @cohort_17 = ClassCohort.find_or_create_by!(graduation_year: 2017) do |c|
      c.key = "17"
      c.display_name = "Class of 2017"
      c.short_label = "'17"
    end
    @cohort_18 = ClassCohort.find_or_create_by!(graduation_year: 2018) do |c|
      c.key = "18"
      c.display_name = "Class of 2018"
      c.short_label = "'18"
    end

    @campaign = HostCampaign.create!(
      tournament: @tournament,
      class_cohort: @cohort_17,
      slug: "2027-class-of-2017",
      title: "Class of 2017 Host Year",
      tagline: "2017 Tagline",
      description: "2017 Private Description",
      hero_image_url: "https://example.com/hero2017.png",
      donation_url: "https://example.com/donate2017",
      donation_instructions: "Payable to CO2017",
      golf_url: "https://fd-golf.shimizu-technology.com",
      hafapass_organizer_slug: "co2017",
      hafapass_tournament_organizer_slug: "fdaa",
      hafapass_distribution_code: "co2017-hub",
      status: "closing",
      featured: true,
      public_meter_enabled: true,
      include_fdaa_in_public_meter: true,
      goal_cents: 3_000_000,
      fdaa_upfront_cents: 1_500_000,
      fdaa_ticket_share_bps: 5_000
    )

    CampaignMembership.create!(host_campaign: @campaign, user: @board, role: "board", active: true)
    @budget_line = @campaign.budget_lines.create!(kind: "expense", category: "Venue & Gym Ops", budget_cents: 250_000, position: 1, notes: "2017 vendor note")
    @archived_line = @campaign.budget_lines.create!(kind: "income", category: "Archived Line", budget_cents: 100_000, position: 2, archived_at: Time.current)
    @event = @campaign.campaign_events.create!(
      kind: "golf",
      title: "Annual Golf Classic",
      venue: "Starts Guam Golf Resort",
      description: "Fundraiser golf scramble",
      starts_at: Time.zone.local(2027, 4, 15, 7, 0),
      date_label: "April 15, 2027",
      external_url: "https://example.com/golf2017",
      image_url: "https://example.com/golf2017.jpg",
      hafapass_event_id: "hp_golf_17",
      hafapass_event_slug: "golf-17",
      hafapass_distribution_code: "golf17",
      status: "open",
      public_visible: true,
      position: 1
    )
    @pledge = @campaign.pledges.create!(donor_name: "Alumni Donor", promised_cents: 100_000, status: "promised", recorded_by: @admin)
    @pending_expense = @campaign.ledger_entries.create!(
      entry_type: "expense",
      amount_cents: 50_000,
      entry_date: Date.new(2027, 6, 1),
      source: "venue_ops",
      payment_method: "cash",
      counterparty: "Water Co",
      paid_by_user: @board,
      reimbursement_status: "requested",
      recorded_by: @admin
    )
  end

  test "final report enforces campaign board/admin RBAC, Cache-Control no-store, and computes outcomes + compliance" do
    # M1: non-completed champion records and other tournaments' champions in the same year must NOT leak or mismatch counts
    other_tournament = Tournament.create!(
      name: "Other 2027 Event",
      year: 2027,
      start_date: Date.new(2027, 8, 1),
      end_date: Date.new(2027, 8, 5),
      status: "completed"
    )
    TournamentChampion.create!(year: 2027, slug: "2027-maroon-pending", tournament: @tournament, bracket: "maroon", status: "research_pending", champion_label: "Pending")
    TournamentChampion.create!(year: 2027, slug: "2027-other-event-gold", tournament: other_tournament, bracket: "gold", status: "completed", champion_label: "Other Event Champ")

    get "/api/v1/campaign/#{@campaign.slug}/finance/final-report", headers: headers_for(@outsider)
    assert_response :forbidden

    get "/api/v1/campaign/#{@campaign.slug}/finance/final-report", headers: headers_for(@board)
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    body = JSON.parse(response.body)

    assert_equal @campaign.slug, body.dig("campaign", "slug")
    assert_equal 2, body.dig("tournamentOutcomes", "teamsCount")
    assert_equal 2, body.dig("tournamentOutcomes", "divisionsCount")
    assert_equal 0, body.dig("tournamentOutcomes", "champions").length
    assert_equal 0, body.dig("compliance", "championsRecordedCount")
    assert_equal 1, body.dig("compliance", "unfinalizedGamesCount") # excludes cancelled and placeholder games!
    assert_equal 1, body.dig("compliance", "pendingReimbursementsCount")
    assert_equal 1, body.dig("compliance", "expensesMissingReceiptCount")
    assert_equal 1, body.dig("compliance", "openCashPledgesCount")
    assert_equal false, body.dig("compliance", "readyToArchive")
  end

  test "POST /admin/campaigns rejects creating an already-archived campaign; PATCH blocks archival; closeout-check and POST /archive enforce blockers, override audit, and cancelled-tournament guard" do
    # L1: Cannot create a campaign directly as archived
    post "/api/v1/admin/campaigns",
      params: {
        campaign: {
          tournamentId: @tournament.id,
          classCohortId: @cohort_18.id,
          slug: "2027-born-archived",
          title: "Born Archived",
          status: "archived",
          goalCents: 1_000_000
        }
      },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["error"], "/archive"

    # Staff forbidden on closeout/archive
    get "/api/v1/admin/campaigns/#{@campaign.id}/closeout-check", headers: headers_for(@staff)
    assert_response :forbidden

    # Direct PATCH to archived MUST be blocked (M6)
    patch "/api/v1/admin/campaigns/#{@campaign.id}",
      params: { campaign: { status: "archived" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["error"], "/archive"
    assert_equal "closing", @campaign.reload.status

    # Closeout check reports exact blockers
    get "/api/v1/admin/campaigns/#{@campaign.id}/closeout-check", headers: headers_for(@admin)
    assert_response :success
    check = JSON.parse(response.body)
    assert_equal false, check["ready"]
    assert_equal 1, check["unfinalizedGamesCount"]
    assert_equal 1, check["pendingReimbursementsCount"]

    # Archive without forceReason or with too-short forceReason fails 422 while blockers exist
    post "/api/v1/admin/campaigns/#{@campaign.id}/archive",
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    post "/api/v1/admin/campaigns/#{@campaign.id}/archive",
      params: { forceReason: "ok" },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    # Archive with forceReason + completeTournament succeeds and records audit event with prior status + warnings
    post "/api/v1/admin/campaigns/#{@campaign.id}/archive",
      params: { forceReason: "Board approved early close-out", completeTournament: true },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    @campaign.reload
    assert_equal "archived", @campaign.status
    assert_equal false, @campaign.featured
    assert_equal "completed", @tournament.reload.status

    audit = @campaign.finance_audit_events.where(action: "archive_campaign").last
    assert_not_nil audit
    assert_equal [ "closing", "archived" ], audit.changes_json["status"]
    assert_equal true, audit.changes_json["tournament_completed"]
    assert_includes audit.changes_json["warnings_at_archive"], "missing_receipts"
    assert_equal "Board approved early close-out", audit.reason

    # Archiving an already-archived campaign returns 422
    post "/api/v1/admin/campaigns/#{@campaign.id}/archive",
      params: { forceReason: "Duplicate" },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    # L3: Archiving with completeTournament must NOT flip a cancelled tournament to completed
    cancelled_tournament = Tournament.create!(
      name: "Cancelled 2029",
      year: 2029,
      start_date: Date.new(2029, 6, 20),
      end_date: Date.new(2029, 7, 10),
      status: "cancelled"
    )
    cancelled_campaign = HostCampaign.create!(
      tournament: cancelled_tournament,
      class_cohort: @cohort_18,
      slug: "2029-cancelled",
      title: "Cancelled 2029 Host Year",
      status: "closing",
      goal_cents: 1_000_000
    )
    post "/api/v1/admin/campaigns/#{cancelled_campaign.id}/archive",
      params: { completeTournament: true },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    assert_equal "cancelled", cancelled_tournament.reload.status
  end

  test "POST /admin/campaigns/:id/clone uses strict copy allowlist, isolates prior year data, rejects duplicate year & occupied targets, and forces upcoming status" do
    # Reject cloning onto source tournament
    post "/api/v1/admin/campaigns/#{@campaign.id}/clone",
      params: { targetTournamentId: @tournament.id, hostClassYear: 2018 },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    # Clone into brand-new 2028 tournament for Class of 2018 (even if caller tries status: "live", forced to "upcoming")
    post "/api/v1/admin/campaigns/#{@campaign.id}/clone",
      params: {
        tournament: {
          name: "FD Alumni Basketball Tournament 2028",
          year: 2028,
          startDate: "2028-06-23",
          endDate: "2028-07-14",
          status: "live"
        },
        hostClassYear: 2018,
        copyDivisions: true,
        copyBudgetCategories: true,
        copyBudgetAmounts: false,
        copyEventTemplates: true
      },
      headers: headers_for(@admin),
      as: :json
    assert_response :created
    body = JSON.parse(response.body)

    cloned = HostCampaign.find(body.dig("campaign", "id"))
    audit_rows = AuditEvent.where(host_campaign_id: cloned.id, action: "create")
    assert_equal %w[BudgetLine CampaignEvent HostCampaign], audit_rows.pluck(:record_type).sort
    assert_equal 1, audit_rows.distinct.count(:operation_id)
    assert_equal [ cloned.tournament_id ], audit_rows.distinct.pluck(:tournament_id)
    assert_equal "upcoming", cloned.tournament.status
    assert_equal "draft", cloned.status
    assert_equal false, cloned.featured
    assert_equal false, cloned.public_meter_enabled
    assert_equal false, cloned.include_fdaa_in_public_meter
    assert_equal 1_500_000, cloned.fdaa_upfront_cents
    assert_equal 5_000, cloned.fdaa_ticket_share_bps

    # Strict cross-year isolation: sensitive/year-specific fields MUST be nil
    assert_nil cloned.tagline
    assert_nil cloned.description
    assert_nil cloned.hero_image_url
    assert_nil cloned.donation_url
    assert_nil cloned.donation_instructions
    assert_nil cloned.golf_url
    assert_nil cloned.hafapass_organizer_slug
    assert_nil cloned.hafapass_tournament_organizer_slug
    assert_nil cloned.hafapass_distribution_code

    # Divisions: only active divisions copied
    assert_equal [ "Maroon", "Special" ], cloned.tournament.divisions.ordered.pluck(:name)

    # Budget lines: only active lines copied, amounts zeroed, notes cleared
    assert_equal 1, cloned.budget_lines.count
    cloned_line = cloned.budget_lines.first
    assert_equal "Venue & Gym Ops", cloned_line.category
    assert_equal 0, cloned_line.budget_cents
    assert_nil cloned_line.notes

    # Event templates: planned, hidden, TBD, zero URLs/HafaPass codes
    assert_equal 1, cloned.campaign_events.count
    cloned_event = cloned.campaign_events.first
    assert_equal "Annual Golf Classic", cloned_event.title
    assert_equal "planned", cloned_event.status
    assert_equal "TBD", cloned_event.date_label
    assert_equal false, cloned_event.public_visible
    assert_nil cloned_event.starts_at
    assert_nil cloned_event.external_url
    assert_nil cloned_event.image_url
    assert_nil cloned_event.hafapass_event_id
    assert_nil cloned_event.hafapass_event_slug
    assert_nil cloned_event.hafapass_distribution_code

    # Zero prior financial/board records copied
    assert_equal 0, cloned.ledger_entries.count
    assert_equal 0, cloned.pledges.count
    assert_equal 0, cloned.campaign_memberships.count
    assert_equal 0, cloned.campaign_invitations.count
    assert_equal 1, cloned.finance_audit_events.where(action: "clone_campaign").count

    # Reject cloning again onto the already-occupied 2028 tournament
    post "/api/v1/admin/campaigns/#{@campaign.id}/clone",
      params: { targetTournamentId: cloned.tournament_id, hostClassYear: 2019 },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    # M2: Reject creating a duplicate tournament for a year (2028) that already has a tournament
    post "/api/v1/admin/campaigns/#{@campaign.id}/clone",
      params: {
        tournament: {
          name: "Duplicate 2028 Tournament",
          year: 2028,
          startDate: "2028-06-23",
          endDate: "2028-07-14"
        },
        hostClassYear: 2019
      },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity
    assert_includes JSON.parse(response.body)["errors"].first, "already exists"
  end

  test "handoff status scopes checklist access and officer identities independently" do
    outgoing_chair = User.create!(email: "outgoing-chair@example.com", role: "viewer")
    @campaign.update!(status: "active")
    @campaign.campaign_memberships.create!(user: outgoing_chair, role: "chair")
    @campaign.campaign_invitations.create!(email: "private-treasurer@example.com", role: "treasurer", invited_by: @admin)
    grant = PermissionGrant.create!(user: @outsider, email: @outsider.email, scope_type: "campaign", scope_id: @campaign.id,
      capability: "fundraisers_and_sponsors", actions: [ "view" ], granted_by: @admin, accepted_at: Time.current)

    get handoff_path(@campaign), headers: headers_for(@outsider)
    assert_response :ok
    assert_nil response.parsed_body.dig("onboarding", "officers")
    assert_equal false, response.parsed_body["canPrepareNextYear"]
    assert_equal "no-store", response.headers["Cache-Control"]
    get handoff_path(@campaign), headers: headers_for(@board)
    assert_response :ok
    assert_nil response.parsed_body.dig("onboarding", "officers")
    get handoff_path(@campaign), headers: headers_for(outgoing_chair)
    assert_response :ok
    assert_equal "private-treasurer@example.com", response.parsed_body.dig("onboarding", "officers", 1, "invitations", 0, "email")

    grant.update!(revoked_at: Time.current)
    get handoff_path(@campaign), headers: headers_for(@outsider)
    assert_response :forbidden
    get handoff_path(@campaign), headers: headers_for(@staff)
    assert_response :forbidden
    get handoff_path(@campaign)
    assert_response :unauthorized
  end

  test "Class of 2017 to Class of 2018 handoff keeps independent finances, access, publication, and archive" do
    @campaign.campaign_invitations.create!(email: "outgoing-only@example.com", role: "chair", invited_by: @admin)
    @campaign.pending_receipt_uploads.create!(uploaded_by: @admin, s3_key: "private/outgoing/pending.pdf",
      original_filename: "pending.pdf", expected_content_type: "application/pdf")
    @pending_expense.update!(receipt_key: "private/outgoing/attached.pdf", receipt_filename: "attached.pdf",
      receipt_content_type: "application/pdf", receipt_byte_size: 256)
    @campaign.ledger_entries.create!(entry_type: "expense", source: "other_expense", amount_cents: 1_000,
      payment_method: "other", counterparty: "Missing receipt", recorded_by: @admin)

    post "/api/v1/admin/campaigns/#{@campaign.id}/clone", params: {
      tournament: { name: "FD Alumni 2028", year: 2028, startDate: "2028-06-23", endDate: "2028-07-14" },
      hostClassYear: 2018, goalCents: 4_000_000
    }, headers: headers_for(@admin), as: :json
    assert_response :created
    incoming = HostCampaign.find(response.parsed_body.dig("campaign", "id"))
    assert incoming.draft?
    assert_equal @cohort_18.id, incoming.class_cohort_id
    assert_equal 1, response.parsed_body["createdEvents"]
    assert_equal 1, response.parsed_body["createdBudgetLines"]
    %i[ledger_entries pending_receipt_uploads pledges campaign_memberships campaign_invitations].each do |relation|
      assert_empty incoming.public_send(relation)
    end
    assert_nil incoming.description
    assert_nil incoming.donation_url
    assert_nil incoming.hafapass_organizer_slug
    assert_nil incoming.hafapass_distribution_code
    template = incoming.campaign_events.first
    assert_nil template.description
    assert_nil template.hafapass_distribution_code
    assert_nil template.hafapass_event_id
    assert_nil template.external_url

    get "/api/v1/public/host-year", params: { slug: incoming.slug }
    assert_response :not_found

    chair = invite_and_verify(incoming, "chair")
    treasurer = invite_and_verify(incoming, "treasurer")
    get handoff_path(incoming), headers: headers_for(chair)
    assert_response :ok
    onboarding = response.parsed_body.fetch("onboarding")
    assert_equal [ true, true ], onboarding.fetch("officers").pluck("accepted")
    assert_includes onboarding.dig("officers", 1, "members", 0, "actions", "finance_and_reimbursements"), "payout"
    assert onboarding["fundingAssumptionsPresent"]
    assert onboarding["firstFundraiserCreated"]
    assert_not onboarding["firstFundraiserScheduled"]
    assert_not onboarding["publicCopyConfigured"]

    get handoff_path(incoming), headers: headers_for(@board)
    assert_response :forbidden
    get handoff_path(@campaign), headers: headers_for(treasurer)
    assert_response :forbidden
    get handoff_path(@campaign), headers: headers_for(@board)
    assert_response :ok
    outgoing = response.parsed_body
    assert_equal({ "id" => incoming.id.to_s, "title" => incoming.title, "slug" => incoming.slug, "status" => "draft",
      "tournamentYear" => 2028, "hasAccess" => false }, outgoing.fetch("relatedNextCampaign"))
    assert_equal %w[pending_reimbursements unfinalized_games], outgoing.dig("closeout", "blockers").pluck("code")
    assert_equal %w[missing_receipts open_cash_pledges missing_champions], outgoing.dig("closeout", "warnings").pluck("code")

    patch "/api/v1/admin/campaigns/#{incoming.id}", params: { campaign: { status: "active" } }, headers: headers_for(@admin), as: :json
    assert_response :ok
    get "/api/v1/public/host-year", params: { slug: incoming.slug }
    assert_response :ok
    assert_equal incoming.id.to_s, response.parsed_body.dig("campaign", "id")
    assert_equal "closing", @campaign.reload.status

    entries_path = "/api/v1/campaign/#{incoming.slug}/ledger-entries"
    post entries_path, params: { ledgerEntry: {
      entryType: "expense", amountCents: 7_500, source: "event_expense", paymentMethod: "card",
      counterparty: "Fixture venue", paidByUserId: treasurer.id, reimbursementStatus: "requested"
    } }, headers: headers_for(treasurer), as: :json
    assert_response :created
    entry = response.parsed_body.dig("ledgerEntry", "id")
    post "#{entries_path}/#{entry}/approve-reimbursement", headers: headers_for(treasurer), as: :json
    assert_response :forbidden
    post "#{entries_path}/#{entry}/approve-reimbursement", headers: headers_for(chair), as: :json
    assert_response :ok
    post "#{entries_path}/#{entry}/mark-reimbursed", headers: headers_for(chair), as: :json
    assert_response :forbidden
    post "#{entries_path}/#{entry}/mark-reimbursed", params: { reimbursementReference: "Fixture payout" }, headers: headers_for(treasurer), as: :json
    assert_response :ok
    assert_equal "reimbursed", response.parsed_body.dig("ledgerEntry", "reimbursementStatus")

    post "/api/v1/admin/tournaments/#{@tournament.id}/champions", params: {
      champion: { bracket: "maroon", championLabel: "Class of 2017", runnerUpLabel: "Class of 2018", score: "75–68" }
    }, headers: headers_for(@admin), as: :json
    assert_response :created
    archive_path = "/api/v1/admin/campaigns/#{@campaign.id}/archive"
    post archive_path, headers: headers_for(@admin), as: :json
    assert_response :unprocessable_entity
    assert_equal 1, response.parsed_body.dig("closeoutCheck", "championsRecordedCount")
    post archive_path, params: { forceReason: "Board recorded exceptions", completeTournament: true }, headers: headers_for(@admin), as: :json
    assert_response :ok
    assert @campaign.reload.archived?
    assert_equal "active", incoming.reload.status
    assert_equal "Board recorded exceptions", @campaign.finance_audit_events.find_by!(action: "archive_campaign").reason
    assert AuditEvent.exists?(host_campaign_id: @campaign.id, actor_id: @admin.id, action: "campaign_archived", reason: "Board recorded exceptions")

    get "/api/v1/campaign/#{@campaign.slug}/finance/final-report", headers: headers_for(@board)
    assert_response :ok
    assert_equal @campaign.id.to_s, response.parsed_body.dig("campaign", "id")
    assert_equal "Class of 2017", response.parsed_body.dig("tournamentOutcomes", "champions", 0, "championLabel")
    patch "/api/v1/campaign/#{@campaign.slug}/settings", params: { tagline: "After archive" }, headers: headers_for(@admin), as: :json
    assert_response :unprocessable_entity
    get entries_path, headers: headers_for(@board)
    assert_response :forbidden
  end

  private

  def handoff_path(campaign)
    "/api/v1/admin/campaigns/#{campaign.id}/handoff-status"
  end

  def invite_and_verify(campaign, role)
    email = "incoming-#{role}@example.com"
    post "/api/v1/admin/campaigns/#{campaign.id}/invitations", params: {
      invitation: { email: email, role: role }
    }, headers: headers_for(@admin), as: :json
    assert_response :created
    assert_equal "pending", response.parsed_body.dig("invitation", "status")

    clerk = "clerk_incoming_#{role}"
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_#{clerk}:#{email}:unverified" }
    assert_response :unauthorized
    assert campaign.campaign_invitations.pending_for_email(email).exists?

    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_#{clerk}:#{email}:verified" }
    assert_response :ok
    assert_not campaign.campaign_invitations.pending_for_email(email).exists?
    User.find_by!(email: email)
  end

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
