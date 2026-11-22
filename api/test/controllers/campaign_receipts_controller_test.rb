require "test_helper"

class CampaignReceiptsControllerTest < ActionDispatch::IntegrationTest
  StubHeadResponse = Struct.new(:code, :headers)

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
    @other_campaign = HostCampaign.create!(
      tournament: @tournament_2028,
      class_cohort: @cohort_2018,
      slug: "2028-class-of-2018",
      title: "Class of 2018 Host Year",
      status: "active",
      featured: false,
      goal_cents: 2_500_000
    )

    @admin = User.create!(email: "admin@example.com", clerk_id: "clerk_admin", role: "admin")
    @staff = User.create!(email: "staff@example.com", clerk_id: "clerk_staff", role: "staff")
    @chair = User.create!(email: "chair@example.com", clerk_id: "clerk_chair", role: "viewer")
    @treasurer = User.create!(email: "treasurer@example.com", clerk_id: "clerk_treasurer", role: "viewer")
    @board = User.create!(email: "board@example.com", clerk_id: "clerk_board", role: "viewer")

    CampaignMembership.create!(host_campaign: @campaign, user: @chair, role: "chair", active: true)
    CampaignMembership.create!(host_campaign: @campaign, user: @treasurer, role: "treasurer", active: true)
    CampaignMembership.create!(host_campaign: @campaign, user: @board, role: "board", active: true)
  end

  test "fails closed with 503 when S3_PRIVATE_BUCKET is unset even if public S3_BUCKET is configured" do
    with_env("S3_BUCKET" => "public-bucket", "S3_PRIVATE_BUCKET" => nil, "S3_ACCESS_KEY_ID" => "AKIA123", "S3_SECRET_ACCESS_KEY" => "secret123") do
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "receipt.jpg", contentType: "image/jpeg", byteSize: 1024 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :service_unavailable
      assert_includes JSON.parse(response.body)["error"], "S3_PRIVATE_BUCKET"
    end
  end

  test "enforces RBAC and MIME/size validation on receipt presign" do
    with_private_s3_env do
      # Board, chair, and non-member staff get 403
      [ @board, @chair, @staff ].each do |user|
        post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
          params: { upload: { filename: "receipt.pdf", contentType: "application/pdf", byteSize: 2048 } },
          headers: auth_headers(user), as: :json
        assert_response :forbidden
      end

      # Unsupported MIME (SVG / HTML) rejected with 400
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "xss.svg", contentType: "image/svg+xml", byteSize: 1024 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :bad_request

      # Oversized >15MB rejected with 400
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "huge.pdf", contentType: "application/pdf", byteSize: 16.megabytes } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :bad_request

      # Valid presign returns uploadToken + POST fields with NO publicUrl and NO raw s3_key top-level
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "../../evil\"\r\n;invoice.pdf", contentType: "application/pdf", byteSize: 4096 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      assert_equal "no-store", response.headers["Cache-Control"]

      body = JSON.parse(response.body)
      assert body["uploadToken"].present?
      assert_nil body["publicUrl"]
      assert_equal "https://fd-private-receipts.s3.ap-southeast-2.amazonaws.com/", body.dig("upload", "url")
      assert_equal "fd-private-receipts", body.dig("upload", "fields", "bucket")
      assert_equal "application/pdf", body.dig("upload", "fields", "Content-Type")
      assert body.dig("upload", "fields", "key").start_with?("receipts/#{@campaign.id}/")
    end
  end

  test "verifies S3 HEAD on attach, blocks replay/expired/cross-campaign tokens, and serves audited RFC 5987 signed GET to board/chair" do
    with_private_s3_env do
      # Presign a receipt with a tricky filename containing quotes and newlines
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "costuless\"\r\nreceipt.jpg", contentType: "image/jpeg", byteSize: 50_000 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      token = JSON.parse(response.body).fetch("uploadToken")

      # S3 HEAD returning wrong content-type is rejected (422)
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "50000", "content-type" => "text/html" }) }) do
        post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 12_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Cost-U-Less",
              receiptUploadToken: token
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # Cross-campaign token usage rejected (422)
      CampaignMembership.create!(host_campaign: @other_campaign, user: @treasurer, role: "treasurer", active: true)
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "48123", "content-type" => "image/jpeg" }) }) do
        post "/api/v1/campaign/#{@other_campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 12_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Cost-U-Less",
              receiptUploadToken: token
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # Valid S3 HEAD attaches receipt with authoritative S3 size & type and writes attach_receipt audit
      captured_head = nil
      with_stubbed_httparty_head(lambda { |url, **opts|
        captured_head = { url: url, opts: opts }
        StubHeadResponse.new(200, { "content-length" => "48123", "content-type" => "image/jpeg" })
      }) do
        post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 12_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Cost-U-Less",
              receiptUploadToken: token
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :created
      end

      assert_includes captured_head[:opts].dig(:headers, "Authorization"), "AWS4-HMAC-SHA256"
      assert_equal false, captured_head[:opts][:follow_redirects]

      entry = JSON.parse(response.body).fetch("ledgerEntry")
      assert_equal true, entry["hasReceipt"]
      assert_equal 48_123, entry["receiptByteSize"]
      assert_equal "image/jpeg", entry["receiptContentType"]
      assert_not_includes entry["receiptFilename"], "\r"
      assert_not_includes entry["receiptFilename"], "\n"
      assert_not_includes entry["receiptFilename"], "\""
      assert FinanceAuditEvent.where(host_campaign: @campaign, record_type: "LedgerEntry", record_id: entry["id"], action: "attach_receipt").exists?

      # Replaying the same uploadToken fails (422)
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "48123", "content-type" => "image/jpeg" }) }) do
        post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 9_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Another Store",
              receiptUploadToken: token
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # Board and chair can fetch signed GET receipt-url; view_receipt audit event recorded
      [ @board, @chair ].each do |viewer|
        get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry['id']}/receipt-url",
          headers: auth_headers(viewer)
        assert_response :success
        assert_equal "no-store", response.headers["Cache-Control"]
        signed = JSON.parse(response.body)
        assert_equal 120, signed["expiresIn"]
        assert_includes signed["url"], "https://fd-private-receipts.s3.ap-southeast-2.amazonaws.com/receipts/#{@campaign.id}/"
        assert_includes signed["url"], "X-Amz-Algorithm=AWS4-HMAC-SHA256"
        assert_includes signed["url"], "X-Amz-Expires=120"
        assert_includes signed["url"], "response-content-disposition="
        assert_includes signed["url"], "X-Amz-Signature="
      end

      assert_equal 2, FinanceAuditEvent.where(host_campaign: @campaign, record_type: "LedgerEntry", record_id: entry["id"], action: "view_receipt").count

      # Non-member staff gets 403 on receipt-url
      get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry['id']}/receipt-url",
        headers: auth_headers(@staff)
      assert_response :forbidden
    end
  end

  test "attaches and replaces receipt via PATCH, enforces uploader ownership, expiry, scalar wrapper, HEIF normalization, and 404/503 receipt-url states" do
    with_private_s3_env do
      # Scalar upload wrapper returns 422 cleanly
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: "oops" },
        headers: auth_headers(@treasurer), as: :json
      assert_response :unprocessable_entity

      # HEIF normalizes to image/heic
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "photo.heif", contentType: "image/heif", byteSize: 4096 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      heif_body = JSON.parse(response.body)
      assert_equal "image/heic", heif_body.dig("upload", "fields", "Content-Type")
      token_one = heif_body.fetch("uploadToken")

      # Direct raw receiptKey is rejected on create
      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
        params: {
          ledgerEntry: {
            entryType: "expense",
            amountCents: 5_000,
            source: "event_expense",
            paymentMethod: "cash",
            counterparty: "Hardware Store",
            receiptKey: "receipts/1/forged.pdf"
          }
        },
        headers: auth_headers(@treasurer), as: :json
      assert_response :unprocessable_entity

      # Create entry without receipt first
      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
        params: {
          ledgerEntry: {
            entryType: "expense",
            amountCents: 5_000,
            source: "event_expense",
            paymentMethod: "cash",
            counterparty: "Hardware Store"
          }
        },
        headers: auth_headers(@treasurer), as: :json
      assert_response :created
      entry_id = JSON.parse(response.body).dig("ledgerEntry", "id")

      # GET receipt-url returns 404 when no receipt is attached
      get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}/receipt-url",
        headers: auth_headers(@board)
      assert_response :not_found

      # Another treasurer cannot attach @treasurer's upload token
      treasurer_two = User.create!(email: "treasurer2@example.com", clerk_id: "clerk_treasurer2", role: "viewer")
      CampaignMembership.create!(host_campaign: @campaign, user: treasurer_two, role: "treasurer", active: true)
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "4096", "content-type" => "image/heic" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: token_one } },
          headers: auth_headers(treasurer_two), as: :json
        assert_response :unprocessable_entity
      end

      # Original uploader attaches via PATCH alongside referenceNumber (which stays redacted in update audit)
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "4096", "content-type" => "image/heic" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: token_one, referenceNumber: "CHK-999" } },
          headers: auth_headers(@treasurer), as: :json
        assert_response :success
      end
      patched = JSON.parse(response.body).fetch("ledgerEntry")
      assert_equal true, patched["hasReceipt"]
      assert_equal "image/heic", patched["receiptContentType"]

      update_audit = FinanceAuditEvent.where(host_campaign: @campaign, record_type: "LedgerEntry", record_id: entry_id, action: "update").last
      assert_equal true, update_audit.changes_json["reference_number_updated"]
      assert_nil update_audit.changes_json["reference_number"]

      # Expired token is rejected
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "expired.pdf", contentType: "application/pdf", byteSize: 1024 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      expired_token = JSON.parse(response.body).fetch("uploadToken")
      PendingReceiptUpload.find_by!(upload_token: expired_token).update!(expires_at: 1.minute.ago)

      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "1024", "content-type" => "application/pdf" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: expired_token } },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end
    end

    # When S3_PRIVATE_BUCKET is unset, receipt-url fails closed with 503
    entry = @campaign.ledger_entries.where.not(receipt_key: nil).first
    with_env("S3_PRIVATE_BUCKET" => nil) do
      get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry.id}/receipt-url",
        headers: auth_headers(@board)
      assert_response :service_unavailable
    end
  end

  test "handles double-dot filenames, preserves previous receipt audit on replace, locks replacement after approval, and handles HEAD/key/void/rate-limit edge cases" do
    with_private_s3_env do
      # M1: Filenames containing '..' collapse cleanly and attach without triggering path traversal guard
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "receipt..final.pdf", contentType: "application/pdf", byteSize: 2048 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      dot_body = JSON.parse(response.body)
      assert_not_includes dot_body.dig("upload", "fields", "key"), ".."
      token_a = dot_body.fetch("uploadToken")

      # Direct client-supplied receiptFilename / receiptContentType / receiptByteSize are rejected
      %w[receiptFilename receiptContentType receiptByteSize].each do |raw_key|
        post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 6_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Office Depot",
              raw_key => "forged"
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # HEAD failures (403, 404, 302, oversized, network error) return 422 without leaking internal host/class
      [
        ->(_url, **_opts) { StubHeadResponse.new(403, {}) },
        ->(_url, **_opts) { StubHeadResponse.new(404, {}) },
        ->(_url, **_opts) { StubHeadResponse.new(302, { "location" => "https://evil.example" }) },
        ->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => (20.megabytes).to_s, "content-type" => "application/pdf" }) },
        ->(_url, **_opts) { raise SocketError, "getaddrinfo: internal-secret-host.local" }
      ].each do |stub|
        with_stubbed_httparty_head(stub) do
          post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
            params: {
              ledgerEntry: {
                entryType: "expense",
                amountCents: 6_000,
                source: "event_expense",
                paymentMethod: "card",
                counterparty: "Office Depot",
                receiptUploadToken: token_a
              }
            },
            headers: auth_headers(@treasurer), as: :json
          assert_response :unprocessable_entity
          assert_not_includes response.body, "SocketError"
          assert_not_includes response.body, "internal-secret-host.local"
        end
      end

      # Attach token_a on create with reimbursement requested
      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "2048", "content-type" => "application/pdf" }) }) do
        post "/api/v1/campaign/#{@campaign.slug}/ledger-entries",
          params: {
            ledgerEntry: {
              entryType: "expense",
              amountCents: 6_000,
              source: "event_expense",
              paymentMethod: "card",
              counterparty: "Office Depot",
              paidByUserId: @treasurer.id,
              reimbursementStatus: "requested",
              receiptUploadToken: token_a
            }
          },
          headers: auth_headers(@treasurer), as: :json
        assert_response :created
      end
      entry_id = JSON.parse(response.body).dig("ledgerEntry", "id")
      first_key = LedgerEntry.find(entry_id).receipt_key

      # M2: Replacing receipt before approval preserves full previous_receipt in attach_receipt audit
      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "updated-invoice.pdf", contentType: "application/pdf", byteSize: 3072 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      token_b = JSON.parse(response.body).fetch("uploadToken")

      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "3072", "content-type" => "application/pdf" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: token_b } },
          headers: auth_headers(@treasurer), as: :json
        assert_response :success
      end

      replace_audit = FinanceAuditEvent.where(host_campaign: @campaign, record_type: "LedgerEntry", record_id: entry_id, action: "attach_receipt").order(:id).last
      assert_equal true, replace_audit.changes_json["replaced_previous_receipt"]
      assert_equal first_key, replace_audit.changes_json.dig("previous_receipt", "receipt_key")
      assert_equal "receipt..final.pdf", replace_audit.changes_json.dig("previous_receipt", "receipt_filename")
      assert_equal 2048, replace_audit.changes_json.dig("previous_receipt", "receipt_byte_size")

      # Chair approves reimbursement; replacing receipt afterwards is blocked (422)
      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}/approve-reimbursement",
        headers: auth_headers(@chair), as: :json
      assert_response :success

      post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
        params: { upload: { filename: "tampered.pdf", contentType: "application/pdf", byteSize: 1024 } },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success
      token_c = JSON.parse(response.body).fetch("uploadToken")

      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "1024", "content-type" => "application/pdf" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: token_c } },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # Attaching receipt to a voided entry via PATCH is rejected (422)
      post "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}/void",
        params: { voidReason: "Duplicate invoice" },
        headers: auth_headers(@treasurer), as: :json
      assert_response :success

      with_stubbed_httparty_head(->(_url, **_opts) { StubHeadResponse.new(200, { "content-length" => "1024", "content-type" => "application/pdf" }) }) do
        patch "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}",
          params: { ledgerEntry: { receiptUploadToken: token_c } },
          headers: auth_headers(@treasurer), as: :json
        assert_response :unprocessable_entity
      end

      # L5: Cross-campaign / malformed receipt_key in DB returns 422 cleanly instead of 500
      LedgerEntry.where(id: entry_id).update_all(receipt_key: "receipts/#{@other_campaign.id}/foreign.pdf")
      get "/api/v1/campaign/#{@campaign.slug}/ledger-entries/#{entry_id}/receipt-url",
        headers: auth_headers(@board)
      assert_response :unprocessable_entity

      # L7: Rate limit enforces 30/min cap when backed by a real cache store
      original_cache = Rails.cache
      begin
        Rails.cache = ActiveSupport::Cache::MemoryStore.new
        travel_to(Time.current.beginning_of_minute + 10.seconds) do
          30.times do
            post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
              params: { upload: { filename: "r.jpg", contentType: "image/jpeg", byteSize: 512 } },
              headers: auth_headers(@treasurer), as: :json
            assert_response :success
          end
          post "/api/v1/campaign/#{@campaign.slug}/receipts/presign",
            params: { upload: { filename: "r.jpg", contentType: "image/jpeg", byteSize: 512 } },
            headers: auth_headers(@treasurer), as: :json
          assert_response :too_many_requests
        end
      ensure
        Rails.cache = original_cache
      end
    end
  end

  private

  def auth_headers(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  def with_private_s3_env
    with_env(
      "S3_PRIVATE_BUCKET" => "fd-private-receipts",
      "S3_REGION" => "ap-southeast-2",
      "S3_ACCESS_KEY_ID" => "AKIATEST123456",
      "S3_SECRET_ACCESS_KEY" => "super-secret-key-for-tests"
    ) { yield }
  end

  def with_env(overrides)
    saved = {}
    overrides.each do |key, val|
      saved[key] = ENV.key?(key) ? ENV[key] : :__missing__
      if val.nil?
        ENV.delete(key)
      else
        ENV[key] = val
      end
    end
    yield
  ensure
    saved.each do |key, val|
      if val == :__missing__
        ENV.delete(key)
      else
        ENV[key] = val
      end
    end
  end

  def with_stubbed_httparty_head(callable)
    singleton = HTTParty.singleton_class
    original = singleton.instance_method(:head)
    singleton.define_method(:head) { |url, **opts| callable.call(url, **opts) }
    yield
  ensure
    singleton.define_method(:head, original) if original
  end
end
