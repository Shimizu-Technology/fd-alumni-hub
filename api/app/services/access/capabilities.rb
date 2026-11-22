module Access
  module Capabilities
    ACTIONS = {
      "site_mode_and_settings" => %w[view edit publish restore],
      "tonights_menu_and_news" => %w[view edit publish alert_site_wide],
      "schedule_and_teams" => %w[view edit import],
      "scores_and_stats" => %w[view edit request_correction correct_final publish_stats],
      "brackets" => %w[view edit resolve_exceptions],
      "fundraisers_and_sponsors" => %w[view edit publish manage_donation_links],
      "finance_and_reimbursements" => %w[view view_receipts record approve payout export],
      "history_and_media" => %w[view edit confirm_champions publish_recap],
      "manage_admins" => %w[view edit],
      "view_audit_log" => %w[view export]
    }.freeze

    SCOPES = %w[site tournament campaign].freeze
  end
end
