module Tonight
  module InfoGuide
    def self.for(tournament)
      {
        "venueName" => "Phoenix Center",
        "venueAddress" => "",
        "ticketSourceName" => "HåfaPass",
        "ticketSourceUrl" => "/tickets",
        "ticketSummary" => "See tournament tickets for current HåfaPass listings and session pricing.",
        "doorInfo" => "Check the ticket listing for entry details for your session.",
        "eligibilityHighlights" => [
          "Players must meet FD alumni or honorary alumni eligibility requirements verified by FD administration.",
          "Players must be 18 or have a parental release on file.",
          "Liability and waiver forms are required before a player can play."
        ],
        "gameRuleHighlights" => [
          "Games use two 20-minute halves with a five-minute halftime.",
          "Teams need five eligible players to start. Grace-period and forfeit rules apply.",
          "Check with tournament staff for season-specific rules."
        ],
        "conductHighlights" => [
          "Complete uniforms are required and jewelry is prohibited during games.",
          "Keep the bench area clean and the court dry and safe.",
          "Treat officials, staff, alumni, families, and fans with respect."
        ],
        "bylawDisclaimer" => "Follow the full tournament bylaws and current instructions from tournament staff."
      }.merge(tournament.info_guide_json)
    end
  end
end
