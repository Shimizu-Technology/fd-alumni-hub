require "test_helper"

class ModularAccessTest < ActionDispatch::IntegrationTest
  ACCESS = "/api/v1/admin/permission_grants"

  setup do
    @admin = User.create!(email: "super@example.test", clerk_id: "super_modular", role: "admin")
    @viewer = User.create!(email: "viewer@example.test", clerk_id: "viewer_modular", role: "viewer")
    @season = tournament(2027)
    @other_season = tournament(2028)
    cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "17")
    @campaign = HostCampaign.create!(tournament: @season, class_cohort: cohort, slug: "first-host", title: "First Host", goal_cents: 1000)
    @other_campaign = HostCampaign.create!(tournament: @other_season, class_cohort: cohort, slug: "second-host", title: "Second Host", goal_cents: 1000)
  end

  test "every preset grants exactly its scoped actions and duties can be combined" do
    Access::Presets::DEFINITIONS.each do |key, (_, scopes, expected)|
      user = User.create!(email: "#{key}@example.test", role: "viewer")
      scope = scopes.first == "campaign" ? @campaign : @season
      other = scopes.first == "campaign" ? @other_campaign : @other_season
      expected.each { |capability, actions| grant(capability, actions, user: user, scope: scope) }
      policy = Access::Policy.new(user)
      Access::Capabilities::ACTIONS.each do |capability, actions|
        actions.each do |action|
          assert_equal expected.fetch(capability, []).include?(action),
            policy.allows?(capability, action, scope_type: scopes.first, scope_id: scope.id), "#{key}: #{capability}/#{action}"
          refute policy.allows?(capability, action, scope_type: scopes.first, scope_id: other.id)
        end
      end
    end
    grant("scores_and_stats", %w[view edit])
    grant("tonights_menu_and_news", %w[view publish])
    get "/api/v1/me", headers: headers(@viewer)
    assert_response :success
    assert_equal %w[work game-day scorekeeper], response.parsed_body.dig("user", "allowedModules")
  end

  test "workspace lookup and same-token revocation are enforced for each request" do
    access = grant("tonights_menu_and_news", %w[view publish])
    get "/api/v1/admin/tournaments", headers: headers(@viewer)
    assert_response :success
    assert_equal [ @season.id.to_s ], response.parsed_body.fetch("tournaments").pluck("id")
    get "/api/v1/admin/game-day-notes", params: { tournamentId: @other_season.id }, headers: headers(@viewer)
    assert_response :forbidden
    get "/api/v1/admin/game-day-notes", params: { tournamentId: @season.id }, headers: headers(@viewer)
    assert_response :success
    access.update!(revoked_at: Time.current)
    get "/api/v1/admin/game-day-notes", params: { tournamentId: @season.id }, headers: headers(@viewer)
    assert_response :forbidden
  end

  test "campaign finance is scoped and audit filters cannot broaden scope" do
    grant("finance_and_reimbursements", %w[view view_receipts], scope: @campaign)
    grant("view_audit_log", %w[view], scope: @campaign)
    get "/api/v1/campaign/#{@campaign.slug}/finance/summary", headers: headers(@viewer)
    assert_response :success
    get "/api/v1/campaign/#{@other_campaign.slug}/finance/summary", headers: headers(@viewer)
    assert_response :forbidden
    get "/api/v1/admin/audit_events", headers: headers(@viewer)
    assert_response :success
    events = response.parsed_body.fetch("auditEvents")
    assert events.any?
    assert_equal [ @campaign.id.to_s ], events.pluck("hostCampaignId").uniq
    get "/api/v1/admin/audit_events", params: { host_campaign_id: @other_campaign.id }, headers: headers(@viewer)
    assert_response :forbidden
    get "/api/v1/admin/audit_events/export", headers: headers(@viewer)
    assert_response :forbidden
    get "/api/v1/admin/audit_events/export", headers: headers(@admin)
    assert_response :success
  end

  test "verified Clerk sign-in attaches pending grants and scope removal preserves the account" do
    post "#{ACCESS}/assign", params: { email: "New@Example.Test", scopeType: "tournament", scopeId: @season.id, presetKey: "scorekeeper" },
      headers: headers(@admin), as: :json
    assert_response :created
    row = PermissionGrant.find_by!(email: "new@example.test")
    assert_nil row.user_id
    event = AuditEvent.find_by!(record_type: "PermissionGrant", record_id: row.id.to_s, action: "create")
    assert_equal @season.id, event.tournament_id

    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_modular_new:new@example.test:unverified" }
    assert_response :unauthorized
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_modular_new:new@example.test:verified" }
    assert_response :success
    assert_equal "/admin/scorekeeper", response.parsed_body.dig("user", "defaultWorkspacePath")
    assert row.reload.accepted_at
    assert_equal "viewer", row.user.role

    post "#{ACCESS}/revoke_scope", params: { email: row.email, scopeType: "tournament", scopeId: @season.id }, headers: headers(@admin), as: :json
    assert_response :no_content
    assert row.reload.revoked_at
    assert row.user.active?
  end

  test "a scoped access manager can assign subset permissions and cannot escalate or self-assign" do
    Access::Presets::DEFINITIONS.fetch("class_chair").last.each do |capability, actions|
      grant(capability, actions, scope: @campaign)
    end
    address = "invite@example.test"
    payload = { email: address, scopeType: "campaign", scopeId: @campaign.id, presetKey: "board_viewer" }
    post "#{ACCESS}/assign", params: payload.merge(scopeId: @other_campaign.id), headers: headers(@viewer), as: :json
    assert_response :forbidden
    post "#{ACCESS}/assign", params: payload.merge(scopeType: "site", scopeId: nil), headers: headers(@viewer), as: :json
    assert_response :forbidden

    # B1: cannot self-assign or escalate beyond own actions (e.g. treasurer payout/export)
    post "#{ACCESS}/assign", params: payload.merge(email: @viewer.email), headers: headers(@viewer), as: :json
    assert_response :forbidden
    post "#{ACCESS}/assign", params: payload.merge(presetKey: "treasurer"), headers: headers(@viewer), as: :json
    assert_response :forbidden
    post "#{ACCESS}/assign", params: payload.merge(presetKey: nil, grants: [
      { capability: "finance_and_reimbursements", actions: %w[view payout] }
    ]), headers: headers(@viewer), as: :json
    assert_response :forbidden

    # B1: cannot revoke a user holding superior actions (e.g. treasurer with payout/export)
    treasurer = User.create!(email: "treasurer@example.test", clerk_id: "treasurer_mod", role: "viewer")
    grant("finance_and_reimbursements", %w[view view_receipts record approve payout export], user: treasurer, scope: @campaign)
    post "#{ACCESS}/revoke_scope", params: { email: treasurer.email, scopeType: "campaign", scopeId: @campaign.id }, headers: headers(@viewer), as: :json
    assert_response :forbidden
    assert PermissionGrant.active.where(user: treasurer, scope_type: "campaign", scope_id: @campaign.id).exists?

    get ACCESS, headers: headers(@viewer)
    assert_response :success
    assert_equal [ @campaign.id.to_s ], response.parsed_body.fetch("campaigns").pluck("id")

    post "#{ACCESS}/assign", params: payload, headers: headers(@viewer), as: :json
    assert_response :created
    row_ids = PermissionGrant.active.where(email: address).pluck(:id).map(&:to_s)
    assert_equal 3, row_ids.count

    post "#{ACCESS}/assign", params: payload.merge(grants: [ { capability: "fundraisers_and_sponsors", actions: %w[view] } ]),
      headers: headers(@viewer), as: :json
    assert_response :created
    new_id = response.parsed_body.fetch("grants").first.fetch("id")
    operations = AuditEvent.where(record_type: "PermissionGrant", record_id: row_ids, action: "update").pluck(:operation_id)
    operations << AuditEvent.find_by!(record_type: "PermissionGrant", record_id: new_id, action: "create").operation_id
    assert_equal 4, operations.size
    assert_equal 1, operations.uniq.size
  end

  test "tournament-scoped audit viewer cannot read campaign or finance audit events" do
    grant("view_audit_log", %w[view], scope: @season)
    @campaign.ledger_entries.create!(recorded_by: @admin, entry_type: "income", amount_cents: 1000,
      source: "donation", payment_method: "cash", counterparty: "Donor")
    @season.update!(name: "FD 2027 Updated")

    get "/api/v1/admin/audit_events", headers: headers(@viewer)
    assert_response :success
    events = response.parsed_body.fetch("auditEvents")
    assert events.any?
    assert events.all? { |event| event["hostCampaignId"].nil? && event["tournamentId"] == @season.id.to_s }
    assert_empty response.parsed_body.dig("filterOptions", "campaigns")
  end

  test "teams index scopes to authorized tournaments even when tournamentId param is omitted" do
    grant("schedule_and_teams", %w[view], scope: @season)
    t1 = @season.teams.create!(class_year_label: "2017", display_name: "Class of 2017")
    @other_season.teams.create!(class_year_label: "2018", display_name: "Class of 2018")

    get "/api/v1/admin/teams", headers: headers(@viewer)
    assert_response :success
    assert_equal [ t1.id.to_s ], response.parsed_body.fetch("teams").pluck("id")

    get "/api/v1/admin/teams", params: { tournament_id: @other_season.id }, headers: headers(@viewer)
    assert_response :forbidden
  end

  test "legacy whitelist demotion removes super_admin and unlinked users stay pending on assign" do
    second_admin = User.create!(email: "second-super@example.test", clerk_id: "second_super", role: "admin")
    entry = AdminWhitelist.create!(email: second_admin.email, role: "admin", active: true)
    patch "/api/v1/admin/whitelists/#{entry.id}", params: { whitelist: { role: "staff" } }, headers: headers(@admin), as: :json
    assert_response :success
    refute second_admin.reload.super_admin?

    unlinked = User.create!(email: "unlinked@example.test", role: "viewer")
    post "#{ACCESS}/assign", params: { email: unlinked.email, scopeType: "tournament", scopeId: @season.id, presetKey: "scorekeeper" },
      headers: headers(@admin), as: :json
    assert_response :created
    grant_row = PermissionGrant.find_by!(email: unlinked.email)
    assert_nil grant_row.user_id
    assert_nil grant_row.accepted_at
  end

  test "a Super Admin who recorded a reimbursement cannot approve it with an override" do
    expense = @campaign.ledger_entries.create!(recorded_by: @admin, entry_type: "expense", amount_cents: 500,
      source: "event_expense", payment_method: "cash", counterparty: "Store", paid_by: "Member", reimbursement_status: "requested")
    post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{expense.id}/approve-reimbursement",
      params: { overrideReason: "Example" }, headers: headers(@admin), as: :json
    assert_response :forbidden
    assert_equal "requested", expense.reload.reimbursement_status
  end

  test "last super admin cannot be demoted or deactivated and explicit false is honored" do
    User.create!(email: "old-role@example.test", role: "admin", super_admin: false)
    [ { superAdmin: false }, { active: false } ].each do |change|
      patch "/api/v1/admin/users/#{@admin.id}/access", params: change, headers: headers(@admin), as: :json
      assert_response :unprocessable_entity
      assert_match "last active Super Admin", response.body
    end
    assert @admin.reload.super_admin?
    assert @admin.active?
  end

  test "bulk link and roster updates reject cross-season records atomically" do
    grant("schedule_and_teams", %w[view edit import])
    first = game(@season)
    other = game(@other_season)
    patch "/api/v1/admin/links/bulk", params: { updates: [
      { id: first.id, ticketUrl: "https://example.test/first" },
      { id: other.id, ticketUrl: "https://example.test/other" }
    ] }, headers: headers(@viewer), as: :json
    assert_response :forbidden
    assert_nil first.reload.ticket_url
    assert_nil other.reload.ticket_url

    assert_no_difference("RosterEntry.count") do
      post "/api/v1/admin/roster-entries/bulk", params: { tournamentId: @season.id, rosterEntries: [
        { teamId: first.home_team_id, name: "First Player" },
        { teamId: other.home_team_id, name: "Other Player" }
      ] }, headers: headers(@viewer), as: :json
      assert_response :forbidden
    end
  end

  test "modular access migration rolls back and restores access audit capture" do
    require Rails.root.join("db/migrate/20261123000003_add_modular_access")
    migration = AddModularAccess.new
    migration.migrate(:down)
    refute User.connection.table_exists?(:permission_grants)
    refute User.connection.column_exists?(:users, :super_admin)
    migration.migrate(:up)
    assert User.connection.column_exists?(:users, :super_admin)
    grant("view_audit_log", %w[view], scope: @campaign)
    event = AuditEvent.where(record_type: "PermissionGrant", host_campaign_id: @campaign.id).last
    assert_equal @season.id, event.tournament_id
    assert_equal "access", event.area
  end

  private

  def game(tournament)
    division = tournament.divisions.create!(name: "Maroon", position: 1)
    home = tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: division)
    away = tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: division)
    tournament.games.create!(home_team: home, away_team: away, division_record: division,
      phase: "pool", start_time: tournament.start_date.in_time_zone, status: "scheduled")
  end

  def grant(capability, actions, user: @viewer, scope: @season)
    PermissionGrant.create!(user: user, email: user.email, scope_type: scope.is_a?(HostCampaign) ? "campaign" : "tournament",
      scope_id: scope.id, capability: capability, actions: actions, accepted_at: Time.current)
  end

  def tournament(year)
    Tournament.create!(name: "FD #{year}", year: year, start_date: Date.new(year, 6, 25), end_date: Date.new(year, 7, 16), status: "upcoming")
  end

  def headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
