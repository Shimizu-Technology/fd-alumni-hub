require "test_helper"

class CampaignRbacAndContentTest < ActionDispatch::IntegrationTest
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
      goal_cents: 3_000_000
    )

    @admin = User.create!(email: "admin-c@example.com", clerk_id: "clerk_c_admin", role: "admin")
    @staff = User.create!(email: "staff-c@example.com", clerk_id: "clerk_c_staff", role: "staff")
    @board = User.create!(email: "board-c@example.com", clerk_id: "clerk_c_board", role: "viewer")
    @chair = User.create!(email: "chair-c@example.com", clerk_id: "clerk_c_chair", role: "viewer")
    @treasurer = User.create!(email: "treasurer-c@example.com", clerk_id: "clerk_c_treasurer", role: "viewer")
    @combo = User.create!(email: "combo-c@example.com", clerk_id: "clerk_c_combo", role: "viewer")

    CampaignMembership.create!(host_campaign: @campaign, user: @board, role: "board", invited_by: @admin)
    CampaignMembership.create!(host_campaign: @campaign, user: @chair, role: "chair", invited_by: @admin)
    CampaignMembership.create!(host_campaign: @campaign, user: @treasurer, role: "treasurer", invited_by: @admin)
    CampaignMembership.create!(host_campaign: @campaign, user: @combo, role: "chair", invited_by: @admin)
    CampaignMembership.create!(host_campaign: @campaign, user: @combo, role: "treasurer", invited_by: @admin)
  end

  test "enforces auth, no-store headers, and role isolation between tournament staff and campaign board" do
    get "/api/v1/campaign/#{@campaign.slug}/settings"
    assert_response :unauthorized
    assert_equal "no-store", response.headers["Cache-Control"]

    get "/api/v1/campaign/#{@campaign.slug}/settings", headers: headers_for(@staff)
    assert_response :forbidden
    assert_equal "no-store", response.headers["Cache-Control"]

    # Board/chair/treasurer with viewer global role cannot touch tournament ops
    get "/api/v1/admin/dashboard", headers: headers_for(@chair)
    assert_response :forbidden

    get "/api/v1/admin/campaigns", headers: headers_for(@staff)
    assert_response :forbidden

    get "/api/v1/admin/whitelists", headers: headers_for(@staff)
    assert_response :forbidden
  end

  test "enforces 3-way settings split across board, chair, treasurer, multi-role, and admin" do
    # Board can read but cannot write
    get "/api/v1/campaign/#{@campaign.slug}/settings", headers: headers_for(@board)
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Blocked" } },
      headers: headers_for(@board),
      as: :json
    assert_response :forbidden

    # Chair can update content settings, blocked on finance & donation settings
    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Brotherhood 2027", golfUrl: "https://fd-golf.shimizu-technology.com" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :success
    assert_equal "Brotherhood 2027", @campaign.reload.tagline

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { goalCents: 4_000_000 } },
      headers: headers_for(@chair),
      as: :json
    assert_response :forbidden

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { donationUrl: "https://evil.example.com/steal" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :forbidden

    # Treasurer can update finance settings, blocked on content & donation settings
    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { goalCents: 3_500_000, fdaaTicketShareBps: 1600 } },
      headers: headers_for(@treasurer),
      as: :json
    assert_response :success
    assert_equal 3_500_000, @campaign.reload.goal_cents

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Treasurer blocked" } },
      headers: headers_for(@treasurer),
      as: :json
    assert_response :forbidden

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { donationUrl: "https://give.example.com/blocked" } },
      headers: headers_for(@treasurer),
      as: :json
    assert_response :forbidden

    # Multi-role (chair + treasurer) can update both content and finance, still blocked on donation channel
    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Combo update", goalCents: 3_600_000 } },
      headers: headers_for(@combo),
      as: :json
    assert_response :success

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { donationUrl: "https://give.example.com/combo-blocked" } },
      headers: headers_for(@combo),
      as: :json
    assert_response :forbidden

    # Global admin can update donation channel and writes audit event
    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { donationUrl: "https://give.fdaa.org/co2017", donationInstructions: "Bank of Guam check payable to CO2017" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    assert_equal "https://give.fdaa.org/co2017", @campaign.reload.donation_url
    assert FinanceAuditEvent.where(host_campaign: @campaign, action: "settings_change").count >= 4
  end

  test "chair manages events, posts, and campaign image uploads while board and treasurer are read-only" do
    post "/api/v1/campaign/#{@campaign.slug}/events",
      params: { event: { kind: "fundraiser", title: "Antigu Night", venue: "Antigu", status: "open" } },
      headers: headers_for(@treasurer),
      as: :json
    assert_response :forbidden

    post "/api/v1/campaign/#{@campaign.slug}/events",
      params: { event: { kind: "fundraiser", title: "Antigu Night", venue: "Antigu", status: "open" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :created
    event_id = JSON.parse(response.body).dig("event", "id")

    post "/api/v1/campaign/#{@campaign.slug}/events/#{event_id}/archive", headers: headers_for(@chair)
    assert_response :success
    assert CampaignEvent.find(event_id).archived?

    post "/api/v1/campaign/#{@campaign.slug}/posts",
      params: { post: { title: "Kickoff", body: "Let's go 2017!" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :created
    post_id = JSON.parse(response.body).dig("post", "id")

    delete "/api/v1/campaign/#{@campaign.slug}/posts/#{post_id}", headers: headers_for(@chair)
    assert_response :no_content
    assert FinanceAuditEvent.where(host_campaign: @campaign, action: "delete_post").exists?

    # Campaign image upload presign works for chair with campaigns/<id>/ key prefix
    with_s3_env do
      post "/api/v1/campaign/#{@campaign.slug}/uploads/presign",
        params: { upload: { filename: "flyer.png", contentType: "image/png", byteSize: 4096 } },
        headers: headers_for(@chair),
        as: :json
      assert_response :success
      key = JSON.parse(response.body).fetch("key")
      assert key.start_with?("campaigns/#{@campaign.id}/")

      post "/api/v1/campaign/#{@campaign.slug}/uploads/presign",
        params: { upload: { filename: "flyer.png", contentType: "image/png", byteSize: 4096 } },
        headers: headers_for(@board),
        as: :json
      assert_response :forbidden
    end
  end

  test "enforces archived campaign read-only for board and audited break-glass for admin" do
    @campaign.update!(featured: false, status: "archived")

    get "/api/v1/campaign/#{@campaign.slug}/settings", headers: headers_for(@chair)
    assert_response :success

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Late edit" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :unprocessable_entity

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Admin without reason" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { tagline: "Audited correction" }, breakGlassReason: "Post-audit typo fix" },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    audit = FinanceAuditEvent.where(host_campaign: @campaign, action: "settings_change").order(:id).last
    assert_equal "Post-audit typo fix", audit.reason
  end

  test "auto-accepts pending campaign invitations only on verified email for both new and existing users" do
    # Admin creates pending invitation for a brand-new board member
    post "/api/v1/admin/campaigns/#{@campaign.id}/invitations",
      params: { invitation: { email: "new-board@example.com", role: "treasurer" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created

    # Unverified Clerk email is rejected and invite remains pending
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_clerk_new_1:new-board@example.com:unverified" }
    assert_response :unauthorized
    assert_equal 1, CampaignInvitation.pending_for_email("new-board@example.com").count

    # Verified Clerk email creates viewer user + accepts invitation automatically
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_clerk_new_1:new-board@example.com:verified" }
    assert_response :success
    me = JSON.parse(response.body).fetch("user")
    assert_equal "viewer", me["role"]
    assert_equal false, me["isStaff"]
    assert_equal [ "treasurer" ], me.dig("campaignMemberships", 0, "roles")
    assert_equal 0, CampaignInvitation.pending_for_email("new-board@example.com").count

    # Existing staff user invited to campaign also gets membership on next auth
    post "/api/v1/admin/campaigns/#{@campaign.id}/invitations",
      params: { invitation: { email: @staff.email, role: "board" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created

    get "/api/v1/me", headers: headers_for(@staff)
    assert_response :success
    staff_me = JSON.parse(response.body).fetch("user")
    assert_equal [ "board" ], staff_me.dig("campaignMemberships", 0, "roles")

    # Revoked invitation is never accepted
    post "/api/v1/admin/campaigns/#{@campaign.id}/invitations",
      params: { invitation: { email: "revoked@example.com", role: "chair" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created
    inv_id = JSON.parse(response.body).dig("invitation", "id")

    post "/api/v1/admin/campaigns/#{@campaign.id}/invitations/#{inv_id}/revoke", headers: headers_for(@admin)
    assert_response :success

    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_clerk_rev_1:revoked@example.com:verified" }
    assert_response :unauthorized
  end

  test "admin manages campaign lifecycle, direct memberships, and whitelists" do
    post "/api/v1/admin/campaigns",
      params: { campaign: { tournamentId: @tournament_2028.id, classCohortId: @cohort_2018.id, slug: "2028-class-of-2018", title: "Class of 2018 Host Year", goalCents: 3_500_000 } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created
    new_campaign_id = JSON.parse(response.body).dig("campaign", "id")

    post "/api/v1/admin/campaigns/#{new_campaign_id}/memberships",
      params: { membership: { userId: @board.id, role: "chair" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created

    post "/api/v1/admin/whitelists",
      params: { whitelist: { email: "new-staff@example.com", role: "staff", notes: "Scorekeeper" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :created
    wl_id = JSON.parse(response.body).dig("whitelist", "id")

    # H1: unverified email cannot bootstrap an allowlisted user or hijack an existing user by email
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_clerk_spoof_1:new-staff@example.com:unverified" }
    assert_response :unauthorized
    assert_nil User.find_by(email: "new-staff@example.com")

    unlinked = User.create!(email: "existing-unlinked@example.com", clerk_id: nil, role: "admin")
    get "/api/v1/me", headers: { "Authorization" => "Bearer test_token_clerk_clerk_hijack_1:existing-unlinked@example.com:unverified" }
    assert_response :unauthorized
    assert_nil unlinked.reload.clerk_id

    # Disabling an allowlist entry preserves the existing account.
    existing_staff = User.create!(email: "new-staff@example.com", clerk_id: "clerk_new_staff_1", role: "staff")
    patch "/api/v1/admin/whitelists/#{wl_id}",
      params: { whitelist: { active: false } },
      headers: headers_for(@admin),
      as: :json
    assert_response :success
    assert existing_staff.reload.active?
    assert_equal "viewer", existing_staff.role
    assert_not existing_staff.staff?

    # L1: unexpected fields like featured/status return explicit 403 for chair
    patch "/api/v1/campaign/#{@campaign.slug}/settings",
      params: { campaign: { featured: false, status: "archived" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :forbidden

    # M3: admin update on archived campaign requires breakGlassReason
    archived_campaign = HostCampaign.find(new_campaign_id)
    archived_campaign.update!(status: "archived")
    patch "/api/v1/admin/campaigns/#{archived_campaign.id}",
      params: { campaign: { title: "No reason" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    patch "/api/v1/admin/campaigns/#{archived_campaign.id}",
      params: { campaign: { title: "With reason" }, breakGlassReason: "Post-close fix" },
      headers: headers_for(@admin),
      as: :json
    assert_response :success

    # L5 & L6: inactive user rejected on membership grant; deactivated membership loses access; cross-campaign ID returns 404
    deactivated = User.create!(email: "inactive-u@example.com", clerk_id: "clerk_inactive_u", role: "viewer", active: false)
    post "/api/v1/admin/campaigns/#{@campaign.id}/memberships",
      params: { membership: { userId: deactivated.id, role: "board" } },
      headers: headers_for(@admin),
      as: :json
    assert_response :unprocessable_entity

    other_event = archived_campaign.campaign_events.create!(kind: "fundraiser", title: "Other campaign event")
    patch "/api/v1/campaign/#{@campaign.slug}/events/#{other_event.id}",
      params: { event: { title: "Cross-campaign IDOR" } },
      headers: headers_for(@chair),
      as: :json
    assert_response :not_found

    membership = CampaignMembership.find_by!(host_campaign: @campaign, user: @board, role: "board")
    membership.update!(active: false)
    get "/api/v1/campaign/#{@campaign.slug}/settings", headers: headers_for(@board)
    assert_response :forbidden
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  def with_s3_env
    keys = %w[S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_REGION]
    backup = keys.to_h { |k| [ k, ENV.fetch(k, nil) ] }
    ENV["S3_BUCKET"] = "fd-alumni-hub-test"
    ENV["S3_ACCESS_KEY_ID"] = "AKIAIOSFODNN7EXAMPLE"
    ENV["S3_SECRET_ACCESS_KEY"] = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
    ENV["S3_REGION"] = "ap-southeast-2"
    yield
  ensure
    backup.each { |k, v| v.nil? ? ENV.delete(k) : ENV[k] = v }
  end
end
