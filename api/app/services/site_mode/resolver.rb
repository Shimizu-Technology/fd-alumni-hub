module SiteMode
  class Resolver
    DEFAULT_SECTIONS = {
      "fundraising" => %w[fundraisers sponsors coverage],
      "schedule_ready" => %w[fundraisers schedule teams tickets bracket sponsors coverage],
      "tournament_live" => %w[fundraisers tonight schedule standings bracket tickets sponsors coverage],
      "tournament_recap" => %w[recap sponsors coverage fundraisers]
    }.freeze
    LINKS = {
      home: [ "Home", "/" ], fundraisers: [ "Fundraisers", "/host-year" ], history: [ "History", "/history" ],
      schedule: [ "Schedule", "/schedule" ], teams: [ "Teams", "/teams" ], tickets: [ "Tickets", "/tickets" ],
      bracket: [ "Bracket", "/bracket" ], tonight: [ "Tonight", "/today" ], standings: [ "Standings", "/standings" ]
    }.freeze

    attr_reader :publication, :tournament, :campaign

    def self.preview(publish_schedule: false, **settings)
      new(publication: SitePublication.new(settings), preview: true, publish_schedule: publish_schedule)
    end

    def initialize(publication: SitePublication.current, preview: false, publish_schedule: false)
      @publication = publication
      @preview = preview
      @publish_schedule = publish_schedule
      @tournament = publication ? publication.tournament : Tournament.active_for_public
      selected_campaign = publication ? publication.host_campaign : HostCampaign.resolve_active_for_home
      @campaign = selected_campaign if selected_campaign&.finance_writable?
    end

    def alerts(for_tournament = tournament)
      scope = TournamentAlert.active_now
      active_seasons = Tournament.upcoming_or_live.reorder(nil).select(:id)
      scope.for_public_tournament(for_tournament).or(scope.where(severity: "urgent", tournament_id: active_seasons)).ordered_for_display.limit(10)
    end

    def schedule_published?
      !!(tournament && (@publish_schedule || tournament.publicly_visible_schedule?))
    end

    def mode
      publication&.mode || suggested_mode
    end

    def suggested_mode
      return "fundraising" unless schedule_published?
      return "tournament_live" if tournament.status == "live"
      return "tournament_recap" if tournament.status == "completed"
      return "schedule_ready" if content["schedule"]

      "fundraising"
    end

    def readiness
      {
        fundraising: missing("fundraisers" => "Choose an active host campaign."),
        schedule_ready: missing("schedule" => "Publish a season with scheduled games.", "teams" => "Add teams to the published season."),
        tournament_live: missing("tonight" => "Add games or a game-day note for today.", "standings" => "Post pool scores or standings.", "bracket" => "Add playoff slots."),
        tournament_recap: missing("recap" => "Confirm the season's champions or add recap copy.")
      }
    end

    def champion_records
      return TournamentChampion.none unless tournament

      TournamentChampion.for_tournament(tournament).completed.includes(tournament_champion_credits: :class_cohort).ordered
    end

    def sections
      @sections ||= SitePublication::SECTIONS.index_with do |section|
        setting = publication&.section_overrides&.fetch(section, "auto") || "auto"
        content.fetch(section) && (setting == "show" || (setting == "auto" && DEFAULT_SECTIONS.fetch(mode).include?(section)))
      end
    end

    def as_json(*)
      {
        mode: mode, versionNumber: publication&.version_number, publishedAt: publication&.published_at&.iso8601,
        publishedByName: publication&.published_by&.full_name, isPreview: @preview,
        tournament: tournament&.api_json, hostCampaign: campaign_summary, schedulePublished: schedule_published?,
        recap: {
          headline: publication&.recap_headline, summary: publication&.recap_summary,
          handoffBannerEnabled: !!publication&.handoff_banner_enabled
        },
        sections: sections, navItems: links(desktop_keys), mobileBottomNav: links(mobile_keys) + [ { label: "More", to: nil } ],
        readiness: readiness, suggestedMode: suggested_mode
      }
    end

    private

    def campaign_summary
      return unless campaign

      summary = campaign.home_summary_json(include_meter: false)
      summary[:nextEvent] = summary[:nextEvent]&.except(:hafapassDistributionCode)
      summary
    end

    def missing(requirements)
      requirements.filter_map { |section, warning| warning unless content.fetch(section) }
    end

    def content
      @content ||= begin
        games = schedule_published? ? tournament.games : Game.none
        today = Time.zone.today
        {
          "fundraisers" => campaign.present?,
          "tonight" => games.where(start_time: today.all_day).exists? || games.where(status: "live").exists? ||
            (!!tournament && schedule_published? && tournament.game_day_notes.active.exists?(date: today, status: "published")),
          "schedule" => games.exists?,
          "teams" => schedule_published? && tournament.teams.exists?,
          "standings" => schedule_published? && (tournament.standings.exists? || games.pool_games.where.not(home_score: nil).where.not(away_score: nil).exists?),
          "bracket" => games.playoff_games.where.not(bracket_slot: nil).exists?,
          "tickets" => campaign.present? || games.where.not(ticket_url: [ nil, "" ]).exists?,
          "sponsors" => !!tournament && tournament.sponsors.active.exists?,
          "coverage" => schedule_published? && tournament.article_links.exists?,
          "recap" => publication&.recap_headline.present? || publication&.recap_summary.present? ||
            (schedule_published? && champion_records.exists?)
        }
      end
    end

    def desktop_keys
      case mode
      when "fundraising" then %i[home fundraisers history]
      when "schedule_ready" then [ :home, :schedule, :teams, :tickets, (:bracket if sections["bracket"]), (:fundraisers if sections["fundraisers"]), :history ].compact
      when "tournament_live" then [ :tonight, :schedule, :standings, :bracket, :tickets, (:fundraisers if sections["fundraisers"]), :history ].compact
      when "tournament_recap" then [ :recap, :history, (:fundraisers if sections["fundraisers"]) ].compact
      end
    end

    def mobile_keys
      case mode
      when "fundraising" then %i[home fundraisers history]
      when "schedule_ready" then [ :home, :schedule, :tickets, (:fundraisers if sections["fundraisers"]) ].compact
      when "tournament_live" then [ :tonight, :schedule, :tickets, (:fundraisers if sections["fundraisers"]) ].compact
      when "tournament_recap" then %i[recap history]
      end
    end

    def links(keys)
      keys.map do |key|
        label, path = key == :recap ? [ "Recap", tournament ? "/history/#{tournament.year}" : "/" ] : LINKS.fetch(key)
        { label: label, to: path }
      end
    end
  end
end
