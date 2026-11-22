require "test_helper"

class AuditContextIsolationTest < ActionDispatch::IntegrationTest
  # Exercises real committed/rolled-back transactions (matching production PgBouncer
  # transaction pooling) where no outer transactional test wrapper is open.
  self.use_transactional_tests = false

  setup do
    @suffix = SecureRandom.hex(4)
    @admin = User.create!(email: "nontx-admin-#{@suffix}@example.test", clerk_id: "nontx_admin_#{@suffix}", first_name: "Ari", role: "admin")
    @target = User.create!(email: "nontx-target-#{@suffix}@example.test", clerk_id: "nontx_target_#{@suffix}", first_name: "Pat", role: "staff")
    @created_whitelist_ids = []
  end

  teardown do
    AdminWhitelist.where(id: @created_whitelist_ids).delete_all if @created_whitelist_ids.any?
    User.where(id: [ @admin&.id, @target&.id ].compact).delete_all
  end

  test "requests and standalone writes use transaction-local GUCs and never leak session settings" do
    # 1. Authenticated GET leaves no session GUCs set.
    get "/api/v1/admin/audit_events", headers: auth_headers(@admin)
    assert_response :success
    assert_session_gucs_blank!

    # 2. Authenticated write captures actor/request via SET LOCAL and clears on COMMIT.
    request_id = "nontx-req-#{@suffix}"
    post "/api/v1/admin/whitelists",
      headers: auth_headers(@admin).merge("X-Request-ID" => request_id),
      params: { whitelist: { email: @target.email, role: "viewer", reason: "Non-tx check" } },
      as: :json
    assert_response :created
    @created_whitelist_ids << response.parsed_body.dig("whitelist", "id")

    assert_session_gucs_blank!
    rows = AuditEvent.where(request_id: request_id).order(:id)
    assert_equal %w[AdminWhitelist User], rows.pluck(:record_type)
    assert_equal [ @admin.id, @admin.id ], rows.pluck(:actor_id)
    assert_equal [ "Non-tx check", "Non-tx check" ], rows.pluck(:reason)

    # 3. Non-transactional update_all inside Audit::Context.with wraps transaction-locally and leaves no leak.
    op_id = "nontx-update-all-#{@suffix}"
    Audit::Context.with(actor: @admin, operation_id: op_id, reason: "Bulk edit") do
      User.where(id: @target.id).update_all(first_name: "UpdatedPat")
    end
    assert_session_gucs_blank!
    event = AuditEvent.find_by!(operation_id: op_id, record_type: "User", record_id: @target.id.to_s)
    assert_equal @admin.id, event.actor_id
    assert_equal "Bulk edit", event.reason

    # 4. Raising inside Audit::Context.with leaves no leaked session GUCs.
    assert_raises(RuntimeError) do
      Audit::Context.with(actor: @admin, operation_id: "nontx-raise-#{@suffix}") do
        ActiveRecord::Base.transaction do
          @target.update!(first_name: "RolledBackPat")
          raise "boom"
        end
      end
    end
    assert_session_gucs_blank!
    refute AuditEvent.exists?(operation_id: "nontx-raise-#{@suffix}")
  end

  private

  def auth_headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  def assert_session_gucs_blank!
    conn = ActiveRecord::Base.connection
    refute conn.transaction_open?, "Expected no open transaction outside request"
    %w[actor_id actor_type actor_name operation_id request_id reason].each do |key|
      val = conn.select_value("SELECT current_setting('app.audit_#{key}', true)")
      assert val.blank?, "Expected session GUC app.audit_#{key} to be blank after transaction, got #{val.inspect}"
    end
  end
end
