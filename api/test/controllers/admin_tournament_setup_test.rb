require "test_helper"

class AdminTournamentSetupTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(email: "setup-admin@example.com", clerk_id: "clerk_setup_admin", role: "admin")
    @staff = User.create!(email: "setup-staff@example.com", clerk_id: "clerk_setup_staff", role: "staff")
  end

  test "setup wizard atomically creates tournament, custom divisions, draft host campaign, and audit event" do
    post "/api/v1/admin/tournaments/setup",
      params: {
        tournament: {
          name: "FD Alumni Basketball Tournament",
          year: 2028,
          startDate: "2028-07-01",
          endDate: "2028-07-22"
        },
        divisions: [
          { name: "Maroon", position: 1, countsForStandings: true },
          { name: "Gold", position: 2, countsForStandings: true },
          { name: "Special", position: 3, countsForStandings: false }
        ],
        hostCampaign: {
          hostClassYear: 2018,
          title: "Class of 2018 Host Year (2028)",
          slug: "2028-class-of-2018",
          goalCents: 3_500_000,
          fdaaUpfrontCents: 500_000
        }
      },
      headers: headers_for(@admin),
      as: :json

    assert_response :created
    body = JSON.parse(response.body)
    assert_equal 2028, body.dig("tournament", "year")
    assert_equal %w[Maroon Gold Special], body.fetch("divisions").map { |d| d["name"] }
    assert_equal false, body.fetch("divisions").last["countsForStandings"]
    assert_equal "draft", body.dig("hostCampaign", "status")
    assert_equal false, body.dig("hostCampaign", "featured")
    assert_equal false, body.dig("hostCampaign", "publicMeterEnabled")

    campaign = HostCampaign.find_by!(slug: "2028-class-of-2018")
    assert_equal 1, campaign.finance_audit_events.where(action: "setup_tournament_campaign").count
  end

  test "setup wizard rolls back entire transaction if campaign validation fails" do
    assert_no_difference [ -> { Tournament.count }, -> { Division.count }, -> { HostCampaign.count } ] do
      post "/api/v1/admin/tournaments/setup",
        params: {
          tournament: {
            name: "FD Alumni Basketball Tournament",
            year: 2029,
            startDate: "2029-07-01",
            endDate: "2029-07-22"
          },
          hostCampaign: {
            hostClassYear: 2019,
            goalCents: 0
          }
        },
        headers: headers_for(@admin),
        as: :json
    end

    assert_response :unprocessable_entity
  end

  test "staff cannot access tournament setup endpoint" do
    post "/api/v1/admin/tournaments/setup",
      params: {
        tournament: { name: "FD 2030", year: 2030, startDate: "2030-07-01", endDate: "2030-07-22" }
      },
      headers: headers_for(@staff),
      as: :json

    assert_response :forbidden
  end

  private

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end
end
