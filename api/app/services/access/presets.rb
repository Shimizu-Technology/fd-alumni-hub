module Access
  module Presets
    FUNDRAISING = { "fundraisers_and_sponsors" => %w[view edit publish] }.freeze
    AUDIT = { "view_audit_log" => %w[view] }.freeze

    DEFINITIONS = {
      "class_chair" => [ "Class Chair", %w[campaign], FUNDRAISING.merge(AUDIT).merge(
        "finance_and_reimbursements" => %w[view view_receipts record approve],
        "manage_admins" => %w[view edit]
      ) ],
      "treasurer" => [ "Treasurer", %w[campaign], AUDIT.merge(
        "finance_and_reimbursements" => Capabilities::ACTIONS.fetch("finance_and_reimbursements")
      ) ],
      "scorekeeper" => [ "Scorekeeper", %w[tournament], {
        "scores_and_stats" => %w[view edit request_correction]
      } ],
      "game_night_coordinator" => [ "Game Night Coordinator", %w[tournament], {
        "tonights_menu_and_news" => %w[view edit publish]
      } ],
      "fundraiser_sponsor_lead" => [ "Fundraiser & Sponsor Lead", %w[campaign tournament], FUNDRAISING ],
      "board_viewer" => [ "Board Viewer", %w[campaign], AUDIT.merge(
        "finance_and_reimbursements" => %w[view view_receipts],
        "fundraisers_and_sponsors" => %w[view]
      ) ]
    }.freeze

    def self.catalog
      DEFINITIONS.map do |key, (label, scopes, grants)|
        { key: key, label: label, scopeTypes: scopes, grants: grants.map { |capability, actions| { capability: capability, actions: actions } } }
      end
    end
  end
end
