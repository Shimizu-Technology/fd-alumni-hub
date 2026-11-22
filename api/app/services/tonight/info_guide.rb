module Tonight
  module InfoGuide
    DEFAULTS = {
      "venueName" => "Phoenix Center",
      "venueAddress" => "",
      "ticketSourceName" => "HåfaPass",
      "ticketSourceUrl" => "/tickets",
      "ticketSummary" => "See tournament tickets for current HåfaPass listings and session pricing.",
      "doorInfo" => "Have your ticket QR code ready at the entrance and keep fire lanes clear when parking.",
      "eligibilityHighlights" => [
        "Players must meet FD alumni or honorary alumni eligibility requirements verified by FD administration.",
        "Players must be 18 or have a parental release on file.",
        "Liability and waiver forms are required before a player can play."
      ],
      "gameRuleHighlights" => [
        "Games use two 20-minute halves with a five-minute halftime. The first 37 minutes run continuously and the final three use a stop clock.",
        "Teams get four timeouts. The older class can steal a timeout before the 10-minute mark.",
        "Pool-play ties go to a three-point shootout. Playoff overtime lasts three minutes.",
        "The four-point circle is in play during pool games.",
        "Teams need five eligible players to start. Grace-period and forfeit rules apply."
      ],
      "conductHighlights" => [
        "Complete uniforms are required and jewelry is prohibited during games.",
        "Keep the bench area clean and the court dry and safe.",
        "Treat officials, staff, alumni, families, and fans with respect.",
        "After the championship, join the Alma Mater circle.",
        "The chow table opens after Game 1. The youngest class cleans up the gym."
      ],
      "bylawDisclaimer" => "Follow the full tournament bylaws and current instructions from tournament staff."
    }.freeze

    def self.for(tournament)
      DEFAULTS.merge(tournament.info_guide_json)
    end
  end
end
