module Tonight
  class Payload
    def self.call(tournament:, day:, alerts:, campaign:, preview: false, voter_hash: nil)
      new(tournament, day).build(alerts, campaign, preview, voter_hash)
    end

    def initialize(tournament, day)
      @tournament = tournament
      @day = day
    end

    def build(alerts, campaign, preview, voter_hash)
      schedule = @tournament.publicly_visible_schedule? || preview
      include_rosters = !preview
      games = schedule ? nightly_games(include_rosters: include_rosters) : []
      next_date = if schedule && games.empty?
        @tournament.games.where(start_time: @day.next_day.beginning_of_day..).minimum(:start_time)&.in_time_zone&.to_date
      end
      notes = @tournament.game_day_notes
      note = schedule ? (preview ? notes : notes.active.where(status: "published")).find_by(date: @day) : nil
      updates = if schedule
        scope = @tournament.tournament_updates.for_night(@day).unexpired.ordered
        preview ? scope : scope.where(status: "published")
      else
        TournamentUpdate.none
      end
      events = nightly_events(campaign)
      polls = schedule ? relevant_polls(@tournament, games).to_a : []

      {
        tournament: @tournament.api_json,
        date: @day.iso8601,
        requestedDate: @day.iso8601,
        resolvedDate: @day.iso8601,
        scheduledDates: schedule ? self.class.scheduled_dates(@tournament, preview: preview) : [],
        nextScheduledDate: next_date&.iso8601,
        isRestDay: schedule && games.empty?,
        alerts: alerts.map(&:api_json),
        games: games.map { |game| game.api_json(include_rosters: include_rosters) },
        gameDayNote: note&.api_json,
        linkedCampaignEvents: events.map(&:public_json),
        updates: updates.map(&:api_json),
        predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_hash) },
        fallbackTicketUrl: Hafapass::EventsClient.all_tickets_url_for(campaign),
        sponsors: @tournament.sponsors.active.ordered_by_tier.limit(4).map(&:api_json),
        lastUpdatedAt: latest_updated_at(note, games, polls, alerts, updates.to_a, events.to_a)&.iso8601
      }
    end

    def self.scheduled_dates(tournament, preview: false)
      notes = tournament.game_day_notes
      notes = notes.active.where(status: "published") unless preview
      game_dates = tournament.games.where(status: %w[scheduled live final]).distinct.pluck(:start_time)
        .compact.map { |tip_off| tip_off.in_time_zone.to_date }
      (game_dates | notes.pluck(:date)).sort.map(&:iso8601)
    end

    def self.campaign_for(tournament)
      HostCampaign.where(tournament: tournament, status: HostCampaign::FEATUREABLE_STATUSES)
        .order(featured: :desc, updated_at: :desc, id: :desc).first
    end

    def self.parse_date(value)
      raise ArgumentError unless value.is_a?(String) && value.match?(/\A\d{4}-\d{2}-\d{2}\z/)

      Date.iso8601(value)
    end

    private

    def nightly_events(campaign)
      return [] unless campaign

      campaign.campaign_events.public_listing
        .where("starts_at < ? AND (starts_at >= ? OR ends_at > ?)",
          @day.next_day.beginning_of_day, @day.beginning_of_day, @day.beginning_of_day)
        .ordered.to_a
    end

    def nightly_games(include_rosters: true)
      team_includes = [ :division_record, { team_class_memberships: :class_cohort } ]
      team_includes << :roster_entries if include_rosters
      @tournament.games
        .includes(:division_record, home_team: team_includes, away_team: team_includes)
        .where(start_time: @day.all_day).ordered.to_a
    end

    def relevant_polls(tournament, games)
      game_ids = games.map(&:id)
      tournament.prediction_polls
        .includes(:prediction_votes, { tournament: { teams: [ :division_record, { team_class_memberships: :class_cohort } ] } }, game: [ { home_team: [ :division_record, { team_class_memberships: :class_cohort } ] }, { away_team: [ :division_record, { team_class_memberships: :class_cohort } ] } ])
        .where("poll_type = ? OR game_id IN (?)", "tournament", game_ids.presence || [ nil ])
        .ordered
    end

    def latest_updated_at(*record_groups)
      record_groups.flatten.compact.filter_map(&:updated_at).max
    end
  end
end
