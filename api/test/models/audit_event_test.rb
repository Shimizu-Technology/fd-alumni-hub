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
