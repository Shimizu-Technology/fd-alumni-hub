require "test_helper"
require Rails.root.join("db/migrate/20261123000005_add_tonight_guide")

class TonightGuideControllerTest < ActionDispatch::IntegrationTest
  NOTES = "/api/v1/admin/game-day-notes"
  UPDATES = "/api/v1/admin/tournament-updates"
  ALERTS = "/api/v1/admin/alerts"
  TODAY = "/api/v1/public/today"
  INFO = "/api/v1/public/info"
  NIGHT = "2032-07-03"

  setup do
    @season = tournament(2032)
    @editor = user("editor", %w[edit])
    @publisher = user("publisher", %w[publish])
    @site_alert_operator = user("site-alert", %w[alert_site_wide], scope: nil)
    @params = { tournamentId: @season.id, date: NIGHT }
  end

  test "a scoped editor drafts and previews but a publisher must publish and unpublish the note" do
    note = {
      date: NIGHT, status: "draft", menuItems: [ { name: "BBQ plate", price: "$12", category: "Food", available: false } ],
      specialEvents: [ { title: "Father-Son", timeLabel: "6:00 PM" } ],
      hostSpotlight: { headline: "Meet the hosts", photoUrl: "/hosts.jpg" }
    }
    post NOTES, params: @params.merge(gameDayNote: note), headers: headers(@editor), as: :json
    assert_response :created
    draft = response.parsed_body.fetch("gameDayNote")
    assert_equal false, draft.dig("menuItems", 0, "available")
    get TODAY, params: @params
    assert_nil response.parsed_body["gameDayNote"]

    assert_no_changes -> { AuditEvent.where(record_type: "GameDayNote").count } do
      get "#{NOTES}/preview", params: @params, headers: headers(@editor)
    end
    assert_response :success
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_equal NIGHT, response.parsed_body["resolvedDate"]
    assert_equal draft, response.parsed_body["gameDayNote"]

    post NOTES, params: @params.merge(gameDayNote: { date: NIGHT, status: "published" }), headers: headers(@editor), as: :json
    assert_response :forbidden
    patch "#{NOTES}/#{draft.fetch("id")}", params: @params.merge(gameDayNote: { status: "published", lockVersion: draft.fetch("lockVersion") }), headers: headers(@publisher), as: :json
    assert_response :success
    published = response.parsed_body.fetch("gameDayNote")
    assert published.fetch("publishedAt")

    post NOTES, params: @params.merge(gameDayNote: { date: NIGHT, announcement: "Unauthorized" }), headers: headers(@editor), as: :json
    assert_response :forbidden
    patch "#{NOTES}/#{draft.fetch("id")}", params: @params.merge(gameDayNote: { status: "draft" }), headers: headers(@editor), as: :json
    assert_response :forbidden
    get TODAY, params: @params
    assert_equal published, response.parsed_body["gameDayNote"]

    patch "#{NOTES}/#{draft.fetch("id")}", params: @params.merge(gameDayNote: { status: "draft", lockVersion: published.fetch("lockVersion") }), headers: headers(@publisher), as: :json
    assert_response :success
    get TODAY, params: @params
    assert_nil response.parsed_body["gameDayNote"]
  end

  test "stale saves return the current note and invalid structured copy is rejected" do
    note = @season.game_day_notes.create!(date: NIGHT, status: "draft")
    version = note.lock_version
    note.update!(food_menu: "Someone else's menu")
    patch "#{NOTES}/#{note.id}", params: @params.merge(gameDayNote: { lockVersion: version, foodMenu: "Stale menu" }), headers: headers(@editor), as: :json
    assert_response :conflict
    assert_equal "Someone else's menu", response.parsed_body.dig("currentNote", "foodMenu")

    post NOTES, params: @params.merge(gameDayNote: { date: NIGHT, lockVersion: nil, foodMenu: "Concurrent first save" }), headers: headers(@editor), as: :json
    assert_response :conflict
    assert_equal note.lock_version, response.parsed_body.dig("currentNote", "lockVersion")

    [
      { menuItems: [ { name: "Plate", available: "false" } ] }, { menuItems: { name: "Plate" } },
      { specialEvents: [ { title: "x" * 181 } ] }, { hostSpotlight: { photoUrl: "//example.test/host.jpg" } },
      { hostSpotlight: { photoUrl: "/\\example.test/host.jpg" } }, { hostSpotlight: { goalCents: 10_000 } },
      { status: "ready" }
    ].each do |copy|
      post NOTES, params: @params.merge(gameDayNote: copy.merge(date: NIGHT, lockVersion: note.lock_version)), headers: headers(@editor), as: :json
      assert_response :unprocessable_entity, copy.inspect
    end
  end

  test "copy previous skips nights without menus and copies legacy or structured copy into a draft" do
    post "#{NOTES}/copy-previous", params: @params, headers: headers(@editor), as: :json
    assert_response :unprocessable_entity

    @season.game_day_notes.create!(date: "2032-07-01", food_menu: "Legacy BBQ", host_spotlight: { headline: "Host night" })
    @season.game_day_notes.create!(date: "2032-07-02", announcement: "No concessions")
    post "#{NOTES}/copy-previous", params: @params, headers: headers(@editor), as: :json
    assert_response :created
    draft = response.parsed_body.fetch("gameDayNote")
    assert_equal "draft", draft["status"]
    assert_equal "Legacy BBQ", draft["foodMenu"]
    assert_equal "Host night", draft.dig("hostSpotlight", "headline")
    assert_nil draft["announcement"]

    new_menu = [ { "name" => "Iced tea", "available" => true } ]
    @season.game_day_notes.find_by!(date: "2032-07-02").update!(menu_items: new_menu)
    post "#{NOTES}/copy-previous", params: @params.merge(lockVersion: draft.fetch("lockVersion")), headers: headers(@editor), as: :json
    assert_response :success
    assert_equal new_menu, response.parsed_body.dig("gameDayNote", "menuItems")
  end

  test "organizer update CRUD, public date and expiry filters, and audit scope" do
    post UPDATES, params: @params.merge(update: { title: "Doors open early", body: "Use the west entrance.", targetDate: NIGHT, pinned: true }), headers: headers(@editor), as: :json
    assert_response :created
    draft = response.parsed_body.fetch("update")
    record = TournamentUpdate.find(draft.fetch("id"))
    assert_equal @editor, record.author
    audit = AuditEvent.find_by!(record_type: "TournamentUpdate", record_id: record.id.to_s, action: "create")
    assert_equal "content", audit.area
    assert_equal "Doors open early", audit.record_label
    assert_equal @season.id, audit.tournament_id

    get UPDATES, params: @params, headers: headers(@editor)
    assert_equal [ draft ], response.parsed_body["updates"]
    get "#{NOTES}/preview", params: @params, headers: headers(@editor)
    assert_equal [ draft ], response.parsed_body["updates"]
    get TODAY, params: @params
    assert_empty response.parsed_body["updates"]

    path = "#{UPDATES}/#{record.id}"
    patch path, params: { update: { status: "published" } }, headers: headers(@editor), as: :json
    assert_response :forbidden
    patch path, params: { update: { status: "published" } }, headers: headers(@publisher), as: :json
    assert_response :success
    assert record.reload.published_at

    @season.tournament_updates.create!(title: "All nights", body: "Bring water", status: "published")
    @season.tournament_updates.create!(title: "Expired", body: "Closed", status: "published", expires_at: 1.minute.ago)
    get TODAY, params: @params
    assert_equal [ "Doors open early", "All nights" ], response.parsed_body["updates"].pluck("title")
    get TODAY, params: @params.merge(date: "2032-07-04")
    assert_equal [ "All nights" ], response.parsed_body["updates"].pluck("title")

    delete path, headers: headers(@editor)
    assert_response :forbidden
    patch path, params: { update: { status: "draft" } }, headers: headers(@editor), as: :json
    assert_response :forbidden
    patch path, params: { update: { status: "draft" } }, headers: headers(@publisher), as: :json
    assert_response :success
    delete path, headers: headers(@editor)
    assert_response :no_content
  end

  test "urgent alerts enforce separate scopes and disappear after removal or expiry" do
    alert = { severity: "urgent", title: "Schedule delay", message: "Check back at seven." }
    post ALERTS, params: { alert: alert.merge(tournamentId: nil) }, headers: headers(@publisher), as: :json
    assert_response :forbidden
    post ALERTS, params: { alert: alert.merge(tournamentId: @season.id) }, headers: headers(@site_alert_operator), as: :json
    assert_response :forbidden
    post ALERTS, params: { alert: alert.merge(tournamentId: nil, expiresAt: 1.minute.ago.iso8601) }, headers: headers(@site_alert_operator), as: :json
    assert_response :created
    post ALERTS, params: { alert: alert.merge(tournamentId: @season.id, title: "Doors delayed") }, headers: headers(@publisher), as: :json
    assert_response :created
    path = "#{ALERTS}/#{response.parsed_body.dig("alert", "id")}"
    get TODAY, params: @params
    assert_equal [ "Doors delayed" ], response.parsed_body["alerts"].pluck("title")
    patch path, params: { alert: { tournamentId: nil } }, headers: headers(@publisher), as: :json
    assert_response :forbidden
    patch path, params: { alert: { active: false } }, headers: headers(@publisher), as: :json
    assert_response :success
    get TODAY, params: @params
    assert_empty response.parsed_body["alerts"]
  end

  test "venue and rules use season overrides and HåfaPass defaults" do
    other = tournament(2033)
    patch "#{NOTES}/info-guide", params: { tournamentId: @season.id, infoGuide: { venueName: "West Gym", gameRuleHighlights: [ "Use a stop clock." ] } },
      headers: headers(@editor), as: :json
    assert_response :forbidden
    patch "#{NOTES}/info-guide", params: { tournamentId: @season.id, infoGuide: { venueName: "West Gym", gameRuleHighlights: [ "Use a stop clock." ] } },
      headers: headers(@publisher), as: :json
    assert_response :success
    get INFO, params: { year: 2032 }
    assert_equal 2032, response.parsed_body.dig("tournament", "year")
    assert_equal "West Gym", response.parsed_body.dig("infoGuide", "venueName")
    assert_equal [ "Use a stop clock." ], response.parsed_body.dig("infoGuide", "gameRuleHighlights")
    assert_equal "/tickets", response.parsed_body.dig("infoGuide", "ticketSourceUrl")
    assert_equal "HåfaPass", response.parsed_body.dig("infoGuide", "ticketSourceName")
    get INFO, params: { tournamentId: other.id }
    assert_equal "Phoenix Center", response.parsed_body.dig("infoGuide", "venueName")
  end

  test "migration down and up preserves legacy notes and restores update audit capture" do
    note = @season.game_day_notes.create!(date: NIGHT, food_menu: "Legacy concessions")
    migration = AddTonightGuide.new
    connection = ActiveRecord::Base.connection
    connection.transaction(requires_new: true) do
      ActiveRecord::Migration.suppress_messages do
        migration.migrate(:down)
        refute connection.table_exists?(:tournament_updates)
        refute connection.column_exists?(:game_day_notes, :status)
        migration.migrate(:up)
      end
      connection.clear_cache!
      assert_equal "Legacy concessions", note.reload.food_menu
      assert_equal "published", note.status
      update = @season.tournament_updates.create!(title: "Audit restored", body: "New update")
      assert AuditEvent.exists?(record_type: "TournamentUpdate", record_id: update.id.to_s, tournament_id: @season.id)
      raise ActiveRecord::Rollback
    end
  ensure
    connection&.clear_cache!
  end

  private

  def tournament(year)
    Tournament.create!(year: year, name: "Season #{year}", start_date: Date.new(year, 7, 1), end_date: Date.new(year, 7, 15),
      status: "live", schedule_published_at: Time.current)
  end

  def user(name, actions, scope: @season)
    user = User.create!(email: "#{name}@example.test", clerk_id: "tonight_#{name}", role: "viewer")
    PermissionGrant.create!(user: user, email: user.email, scope_type: scope ? "tournament" : "site",
      scope_id: scope&.id, capability: "tonights_menu_and_news", actions: actions)
    user
  end

  def headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
