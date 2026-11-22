require "test_helper"
require Rails.root.join("db/migrate/20261123000002_complete_audit_coverage")

require Rails.root.join("db/migrate/20261123000006_add_gym_results_and_corrections")

class AuditCheckpointTest < ActiveSupport::TestCase
  test "checkpoints link, verify and are idempotent across sequence gaps" do
    with_signing_key("checkpoint-test-key") do
      create_event
      first = Audit::CheckpointService.create!
      assert_equal first, Audit::CheckpointService.create!
      assert first.hmac_signature.present?

      AuditEvent.transaction(requires_new: true) do
        create_event
        raise ActiveRecord::Rollback
      end
      latest_event = create_event
      assert_equal 1, Audit::CheckpointService.verify![:uncheckpointed_events]

      second = Audit::CheckpointService.create!
      assert_equal first.chain_digest, second.previous_digest
      assert_equal latest_event.id, second.first_audit_event_id
      assert_equal 1, second.event_count
      assert_equal({
        valid: true,
        signed: true,
        checked_count: 2,
        unsigned_checkpoints: 0,
        latest_checkpoint_id: second.id,
        uncheckpointed_events: 0,
        warnings: [],
        errors: []
      }, Audit::CheckpointService.verify!)

      with_signing_key("incorrect-key") do
        result = Audit::CheckpointService.verify!
        refute result[:valid]
        assert_match(/HMAC signature mismatch/, result[:errors].first)
      end
    end

    with_signing_key(nil) do
      create_event
      Audit::CheckpointService.create!
      result = Audit::CheckpointService.verify!
      assert result[:valid]
      refute result[:signed]
      assert_equal 1, result[:unsigned_checkpoints]
      assert result[:warnings].any? { |warning| warning.include?("AUDIT_CHECKPOINT_SIGNING_KEY") }
    end
  end

  test "verification detects a checkpoint persisted with an incorrect digest" do
    event = create_event
    AuditCheckpoint.create!(first_audit_event_id: event.id, last_audit_event_id: event.id,
      event_count: 1, chain_digest: "invalid")
    result = Audit::CheckpointService.verify!
    refute result[:valid]
    assert result[:errors].any? { |error| error.include?("chain digest mismatch") }
  end

  test "model and database reject modifications to checkpoints" do
    create_event
    checkpoint = Audit::CheckpointService.create!
    assert_raises(ActiveRecord::ReadOnlyRecord) { checkpoint.update!(chain_digest: "changed") }
    assert_raises(ActiveRecord::ReadOnlyRecord) { checkpoint.destroy! }

    [ "UPDATE audit_checkpoints SET chain_digest = 'changed'", "DELETE FROM audit_checkpoints", "TRUNCATE audit_checkpoints" ].each do |sql|
      error = assert_raises(ActiveRecord::StatementInvalid) do
        AuditCheckpoint.transaction(requires_new: true) { AuditCheckpoint.connection.execute(sql) }
      end
      assert_match(/append-only/, error.message)
    end
  end

  test "migration can roll coverage back and reinstall all domain triggers" do
    connection = AuditEvent.connection
    migration = CompleteAuditCoverage.new
    migration.migrate(:down)
    refute connection.table_exists?(:audit_checkpoints)
    assert_equal Audit::DatabaseTriggers::ORIGINAL_TABLES.map(&:to_s).sort, captured_tables(connection)

    migration.migrate(:up)
    assert connection.table_exists?(:audit_checkpoints)
    expected = connection.tables - %w[audit_events audit_checkpoints finance_audit_events schema_migrations ar_internal_metadata score_mutations]
    assert_equal Audit::DatabaseTriggers::RECORD_TYPES.size, expected.size
    assert_equal expected.sort, captured_tables(connection)
  end

  test "gym results migration rolls back and restores storage and correction auditing" do
    connection = AuditEvent.connection
    migration = AddGymResultsAndCorrections.new
    migration.migrate(:down)
    assert_not connection.column_exists?(:games, :result_outcome)
    assert_not connection.table_exists?(:score_mutations)
    assert_not connection.table_exists?(:score_correction_requests)
    assert_includes captured_tables(connection), "games"

    migration.migrate(:up)
    assert connection.column_exists?(:games, :official_winner_team_id)
    assert connection.index_exists?(:score_mutations, %i[actor_id game_id client_mutation_id], unique: true)
    assert_includes captured_tables(connection), "score_correction_requests"
    assert_not_includes captured_tables(connection), "score_mutations"
  end

  private

  def create_event
    AuditEvent.create!(area: "content", action: "update", record_type: "TournamentAlert",
      record_id: "1", operation_id: "checkpoint-test", summary: "Alert updated")
  end

  def with_signing_key(key)
    previous = ENV["AUDIT_CHECKPOINT_SIGNING_KEY"]
    ENV["AUDIT_CHECKPOINT_SIGNING_KEY"] = key
    yield
  ensure
    ENV["AUDIT_CHECKPOINT_SIGNING_KEY"] = previous
  end

  def captured_tables(connection)
    connection.select_values("SELECT event_object_table FROM information_schema.triggers
      WHERE trigger_schema = current_schema() AND trigger_name = 'fd_audit_capture'
      AND event_manipulation = 'INSERT' ORDER BY event_object_table")
  end
end
