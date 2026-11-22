require "test_helper"

class AdminAuditEventsControllerTest < ActionDispatch::IntegrationTest
  PATH = "/api/v1/admin/audit_events"

  setup do
    @admin = User.create!(email: "audit-admin@example.test", clerk_id: "audit_clerk", first_name: "Ari", role: "admin")
    @staff = User.create!(email: "audit-staff@example.test", clerk_id: "staff_clerk", role: "staff")
    @tournament = Tournament.create!(name: "FD Alumni Basketball", year: 2027,
      start_date: Date.new(2027, 6, 25), end_date: Date.new(2027, 7, 16), status: "upcoming")
    cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "17")
    Audit::Context.with(actor: @admin, operation_id: "campaign-audit", ip_address: "192.0.2.1") do
      @campaign = HostCampaign.create!(tournament: @tournament, class_cohort: cohort, slug: "gold-drive",
        title: "Gold Drive", goal_cents: 20_000)
      @campaign.update!(title: "Gold Drive 100%", tagline: "https://example.test/?token=private")
    end
  end

  test "requires admin access" do
    get PATH
    assert_response :unauthorized
    get PATH, headers: auth_headers(@staff)
    assert_response :forbidden
    get PATH, headers: auth_headers(@admin)
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
  end

  test "supports combined filters and treats search punctuation literally" do
    get PATH, headers: auth_headers(@admin), params: {
      area: "campaigns", q: "gOLD drive 100%", actor_id: @admin.id, operation_id: "campaign-audit",
      tournament_id: @tournament.id, host_campaign_id: @campaign.id, record_type: "HostCampaign",
      record_id: @campaign.id, action: "update"
    }
    assert_response :success
    body = response.parsed_body
    assert_equal 1, body["auditEvents"].size
    event = body["auditEvents"].first
    assert_equal "Gold Drive", event.dig("before", "title")
    assert_equal "Gold Drive 100%", event.dig("after", "title")
    refute_includes response.body, "192.0.2.1"
    refute_includes response.body, "token=private"
    assert_includes body.dig("filterOptions", "areas"), "campaigns"
    assert_includes body.dig("filterOptions", "actors"), { "id" => @admin.id.to_s, "label" => "Ari" }
    assert_includes body.dig("filterOptions", "campaigns"), { "id" => @campaign.id.to_s, "label" => @campaign.title }
    assert_includes body.dig("filterOptions", "tournaments").pluck("id"), @tournament.id.to_s

    get PATH, headers: auth_headers(@admin), params: { q: "Gold_Drive" }
    assert_empty response.parsed_body["auditEvents"]
  end

  test "paginates equal timestamps without overlap and validates the cursor" do
    expected = AuditEvent.where(operation_id: "campaign-audit").order(occurred_at: :desc, id: :desc).ids.map(&:to_s)
    get PATH, headers: auth_headers(@admin), params: { operation_id: "campaign-audit", limit: 1 }
    assert_response :success
    first = response.parsed_body
    assert_equal expected.first(1), first["auditEvents"].pluck("id")
    assert first["nextCursor"].present?

    get PATH, headers: auth_headers(@admin), params: { operation_id: "campaign-audit", limit: 1, cursor: first["nextCursor"] }
    assert_response :success
    assert_equal expected.last(1), response.parsed_body["auditEvents"].pluck("id")
    assert_nil response.parsed_body["nextCursor"]

    get PATH, headers: auth_headers(@admin), params: { cursor: "bad cursor" }
    assert_response :bad_request
  end

  test "uses Guam dates for inclusive day filters" do
    AuditEvent.create!(occurred_at: Time.iso8601("2027-07-01T14:00:00Z"), operation_id: "day-check",
      area: "system", action: "update", record_type: "Game", record_id: "1", summary: "Game changed")
    get PATH, headers: auth_headers(@admin), params: { operation_id: "day-check", from: "2027-07-02", to: "2027-07-02" }
    assert_equal 1, response.parsed_body["auditEvents"].size

    get PATH, headers: auth_headers(@admin), params: { operation_id: "day-check", to: "2027-07-01" }
    assert_empty response.parsed_body["auditEvents"]
  end

  test "authenticated writes capture request context and group changes" do
    post "/api/v1/admin/whitelists", headers: auth_headers(@admin).merge("X-Request-ID" => "audit-request-1"),
      params: { whitelist: { email: @staff.email, role: "viewer", reason: "Role changed" } }, as: :json
    assert_response :created
    rows = AuditEvent.where(request_id: "audit-request-1").order(:id)
    assert_equal %w[AdminWhitelist User], rows.pluck(:record_type)
    assert_equal 1, rows.pluck(:operation_id).uniq.size
    rows.each do |event|
      assert_equal @admin.id, event.actor_id
      assert_equal "Ari", event.actor_name
      assert_equal "admin", event.actor_role
      assert_equal "POST", event.http_method
      assert_equal "/api/v1/admin/whitelists", event.route_path
      assert_equal "Role changed", event.reason
      assert event.ip_address.present?
    end
    @staff.update!(first_name: "Outside request")
    assert_equal "system", AuditEvent.last.actor_type
    assert_nil AuditEvent.last.request_id
  end

  private

  def auth_headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
