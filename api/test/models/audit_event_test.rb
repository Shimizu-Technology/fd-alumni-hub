require "test_helper"

class AuditEventTest < ActiveSupport::TestCase
  setup do
    @actor = User.create!(email: "auditor@example.test", first_name: "Ari", last_name: "Admin", role: "admin")
    @tournament = Tournament.create!(name: "Alumni Basketball", year: 2027,
      start_date: Date.new(2027, 6, 25), end_date: Date.new(2027, 7, 16), status: "upcoming")
    @cohort = ClassCohort.create!(key: "17", graduation_year: 2017, display_name: "Class of 2017", short_label: "17")
  end

  test "model and direct SQL cannot update delete or truncate audit history" do
    event = AuditEvent.last
    assert_raises(ActiveRecord::ReadOnlyRecord) { event.update!(summary: "Changed") }
    assert_raises(ActiveRecord::ReadOnlyRecord) { event.destroy! }

    [
      "UPDATE audit_events SET summary = 'Changed'",
      "DELETE FROM audit_events",
      "TRUNCATE audit_events"
    ].each do |sql|
      error = assert_raises(ActiveRecord::StatementInvalid) do
        AuditEvent.transaction(requires_new: true) { AuditEvent.connection.execute(sql) }
      end
      assert_match(/append-only/, error.message)
    end
    assert AuditEvent.exists?(event.id)
  end

  test "records create update and delete on each core table with actor and operation snapshots" do
    Audit::Context.with(actor: @actor, operation_id: "bulk-edit", reason: "Correcting records") do
      user = User.create!(email: "member@example.test", clerk_id: "clerk-private")
      campaign = create_campaign
      game = create_game
      whitelist = AdminWhitelist.create!(email: "whitelist@example.test", role: "staff")
      membership = CampaignMembership.create!(host_campaign: campaign, user: user, role: "chair")
      invitation = CampaignInvitation.create!(host_campaign: campaign, email: "invite@example.test", role: "board", invited_by: @actor)

      [
        [ invitation, :revoked_at, Time.current, "invite@example.test" ],
        [ membership, :active, false, "member@example.test" ],
        [ whitelist, :role, "viewer", "whitelist@example.test" ],
        [ game, :home_score, 60, "Game #A1" ],
        [ campaign, :title, "Closing drive", "Closing drive" ],
        [ user, :first_name, "Jamie", "member@example.test" ]
      ].each do |record, attribute, value, label|
        updated = record.public_send(attribute)
        record.update!(attribute => value)
        record.destroy!

        create, update, delete = AuditEvent.where(operation_id: "bulk-edit", record_type: record.class.name,
          record_id: record.id.to_s).order(:id).to_a
        assert_equal "create", create.action
        assert_equal({}, create.before_json)
        assert_equal record.id, create.after_json["id"]
        updated.nil? ? assert_nil(update.before_json[attribute.to_s]) : assert_equal(updated, update.before_json[attribute.to_s])
        assert_equal delete.before_json[attribute.to_s], update.after_json[attribute.to_s]
        assert_equal "delete", delete.action
        assert_equal({}, delete.after_json)
        assert_equal label, update.record_label
        assert_equal "Ari Admin", update.actor_name
        assert_equal @actor.id, update.actor_id
        assert_equal @actor.email, update.actor_email
        assert_equal "admin", update.actor_role
        assert_equal "Correcting records", update.reason
        assert_includes update.summary, "Ari Admin"
        assert_includes update.summary, label
        assert_equal "[Redacted]", create.after_json["clerk_id"] if record.is_a?(User)
        refute_includes create.after_json.to_json, "clerk-private"
        assert_nil create.after_json["last_score_mutation_digest"] if record.is_a?(Game)
        assert_match(/score from 58-54 to 60-54/, update.summary) if record.is_a?(Game)
      end
    end
  end

  test "rollback removes captured events and true no-ops produce no history while redacted field edits are audited" do
    game = create_game
    campaign = create_campaign
    assert_no_difference("AuditEvent.count") do
      assert_raises(RuntimeError) do
        AuditEvent.transaction(requires_new: true) do
          game.update!(home_score: 60)
          campaign.update!(title: "Rolled back")
          raise "rollback"
        end
      end

      game.reload.touch
    end
    assert_equal 58, game.reload.home_score
    assert_equal "Host campaign", campaign.reload.title

    assert_difference("AuditEvent.count", 1) do
      User.where(id: @actor.id).update_all(clerk_id: "private-value")
    end
    event = AuditEvent.last
    assert_nil event.before_json["clerk_id"]
    assert_equal "[Redacted]", event.after_json["clerk_id"]
    refute_includes event.after_json.to_json, "private-value"
  end

  test "bulk SQL writes group system updates per transaction and nested context restores after database error" do
    other = User.create!(email: "other@example.test", first_name: "Sam", role: "viewer")
    Audit::Context.with(actor: @actor, operation_id: "outer") do
      assert_raises(ActiveRecord::StatementInvalid) do
        Audit::Context.with(operation_id: "inner") do
          AuditEvent.connection.execute("SELECT 1/0")
        end
      end
      User.where(id: @actor.id).update_all(first_name: "Updated")
      assert_equal "outer", AuditEvent.last.operation_id
    end

    User.where(id: [ @actor.id, other.id ]).update_all(last_name: "SystemUpdate")
    recent = AuditEvent.order(:id).last(2)
    assert_equal %w[system system], recent.map(&:actor_type)
    assert_equal [ nil, nil ], recent.map(&:actor_id)
    assert_equal 1, recent.map(&:operation_id).uniq.size
    assert_match(/\Atx-\d+\z/, recent.first.operation_id)
    refute_equal "outer", recent.first.operation_id
  end

  test "set_actor! applies inside an unmaterialized savepoint after an outer write" do
    other = User.create!(email: "savepoint-actor@example.test", first_name: "Sam", role: "staff")
    Audit::Context.with(actor: @actor, operation_id: "savepoint-actor-op") do
      @actor.update!(first_name: "AriOuter")
      ActiveRecord::Base.transaction(requires_new: true) do
        Audit::Context.set_actor!(other)
        other.update!(first_name: "SamInner")
      end
    end

    inner_event = AuditEvent.find_by!(operation_id: "savepoint-actor-op", record_type: "User", record_id: other.id.to_s)
    assert_equal other.id, inner_event.actor_id
    assert_equal "Sam", inner_event.actor_name
  end

  test "finance sync redacts nested secrets and backfills without duplicates" do
    campaign = create_campaign
    changes = { "amount_cents" => [ 100, 150 ], "receiptKey" => "private/receipt",
                "files" => [ { "uploadToken" => "private-token", "link" => "https://example.test/receipt?X-Amz-Signature=private" } ] }
    event = FinanceAuditEvent.record!(campaign: campaign, actor: @actor, record: campaign, action: "update", changes: changes)
    existing = AuditEvent.find_by!(legacy_finance_audit_event_id: event.id)
    assert_equal "finance", existing.area
    assert_equal "finance_audit_events", existing.metadata_json["legacySource"]
    assert_equal(
      {
        "amount_cents" => [ 100, 150 ],
        "receiptKey" => "[Redacted]",
        "files" => [ { "uploadToken" => "[Redacted]", "link" => "[Redacted]" } ]
      },
      existing.after_json["changes"]
    )
    refute_includes existing.after_json.to_json, "private/receipt"
    refute_includes existing.after_json.to_json, "private-token"
    assert_equal changes, event.reload.changes_json

    unbridged = FinanceAuditEvent.insert_all!([ event.attributes.except("id") ]).first.fetch("id")
    assert_difference("AuditEvent.count", 1) do
      Audit::LegacyFinanceSync.backfill!
      Audit::LegacyFinanceSync.backfill!
      Audit::LegacyFinanceSync.sync_event!(event)
    end
    assert AuditEvent.exists?(legacy_finance_audit_event_id: unbridged)

    assert_no_difference([ "AuditEvent.count", "FinanceAuditEvent.count" ]) do
      FinanceAuditEvent.transaction(requires_new: true) do
        FinanceAuditEvent.record!(campaign: campaign, actor: @actor, record: campaign, action: "update")
        raise ActiveRecord::Rollback
      end
    end
  end

  test "alert deletion retains the entire before snapshot" do
    alert = TournamentAlert.create!(tournament: @tournament, title: "Court change", message: "Use the south court")
    original = alert.attributes
    alert.destroy!

    event = AuditEvent.last
    assert_equal [ "content", "delete", "TournamentAlert", @tournament.id ], [ event.area, event.action, event.record_type, event.tournament_id ]
    assert_equal original.keys.sort, event.before_json.keys.sort
    assert_equal "Use the south court", event.before_json["message"]
    assert_empty event.after_json
  end

  test "database cascades capture all team children in one scoped operation" do
    team = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017")
    team.team_class_memberships.find_or_create_by!(class_cohort: @cohort)
    team.roster_entries.create!(name: "Player One")
    @tournament.standings.create!(team: team)
    poll = PredictionPoll.create!(tournament: @tournament, poll_type: "tournament", question: "Who wins?")
    poll.prediction_votes.create!(team: team, voter_token_hash: "secret-vote-hash")
    first_id = AuditEvent.last.id

    Team.where(id: team.id).delete_all

    rows = AuditEvent.where("id > ?", first_id)
    assert_equal %w[PredictionVote RosterEntry Standing Team TeamClassMembership], rows.pluck(:record_type).sort
    assert_equal [ "delete" ], rows.distinct.pluck(:action)
    assert_equal [ @tournament.id ], rows.distinct.pluck(:tournament_id)
    assert_equal 1, rows.distinct.count(:operation_id)
    vote_delete = rows.find_by!(record_type: "PredictionVote")
    assert_equal "system", vote_delete.actor_type
  end

  test "anonymous prediction votes drop ip_address and request_id from audit history" do
    team = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018")
    poll = PredictionPoll.create!(tournament: @tournament, poll_type: "tournament", question: "Champion?")
    Audit::Context.with(request_id: "vote-req-1", http_method: "POST", route_path: "/api/v1/public/prediction_votes", ip_address: "203.0.113.9") do
      poll.prediction_votes.create!(team: team, voter_token_hash: "secret-voter-hash")
    end

    event = AuditEvent.where(record_type: "PredictionVote", action: "create").last
    assert_equal "anonymous", event.actor_type
    assert_nil event.ip_address
    assert_nil event.request_id
    assert_equal "[Redacted]", event.after_json["voter_token_hash"]
    refute_includes event.after_json.to_json, "secret-voter-hash"
  end

  test "sensitive field rotations identify the change without storing raw values" do
    campaign = create_campaign
    @actor.update!(clerk_id: "old-private-clerk")
    campaign.update!(hafapass_distribution_code: "old-private-code", hero_image_url: "https://example.test/img?sig=old-private")
    @actor.update!(clerk_id: "new-private-clerk")
    assert_redacted_rotation(AuditEvent.last, "clerk_id")

    campaign.update!(hafapass_distribution_code: "new-private-code", hero_image_url: "https://example.test/img?sig=new-private")
    assert_redacted_rotation(AuditEvent.last, "hafapass_distribution_code")
    assert_redacted_rotation(AuditEvent.last, "hero_image_url")
  end

  test "HafaPass captures payload and error changes while ignoring lease and sync timestamps" do
    snapshot = HafapassEventSnapshot.create!(organizer_slug: "audit-snapshot")
    assert_no_difference("AuditEvent.count") do
      snapshot.acquire_refresh_lease!
      snapshot.reload.update!(fetched_at: Time.current, last_error_at: Time.current)
    end
    assert_difference("AuditEvent.count", 2) do
      snapshot.update!(payload_json: [ { "title" => "Golf" } ])
      snapshot.update!(last_error: "Unavailable")
    end
    assert_equal "Unavailable", AuditEvent.last.after_json["last_error"]
  end

  def assert_redacted_rotation(event, field)
    assert_equal "[Redacted]", event.before_json[field]
    assert_equal "[Redacted · changed]", event.after_json[field]
    refute_match(/(?:old|new)-private/, event.api_json.to_json)
  end

  private

  def create_campaign
    HostCampaign.create!(tournament: @tournament, class_cohort: @cohort, slug: "host-campaign",
      title: "Host campaign", status: "active", goal_cents: 10_000)
  end

  def create_game
    division = @tournament.divisions.create!(name: "Maroon", position: 1)
    home = @tournament.teams.create!(class_year_label: "2017", display_name: "Class of 2017", division_record: division)
    away = @tournament.teams.create!(class_year_label: "2018", display_name: "Class of 2018", division_record: division)
    @tournament.games.create!(home_team: home, away_team: away, start_time: Time.current, status: "final",
      home_score: 58, away_score: 54, game_number: "A1")
  end
end
