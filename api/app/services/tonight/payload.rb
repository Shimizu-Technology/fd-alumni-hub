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
      games = schedule ? nightly_games : []
      next_date = if schedule && games.empty?
        @tournament.games.where(start_time: @day.next_day.beginning_of_day..).minimum(:start_time)&.in_time_zone&.to_date
      end
      notes = @tournament.game_day_notes
      note = (preview ? notes : notes.active.where(status: "published")).find_by(date: @day)
      updates = @tournament.tournament_updates.for_night(@day).unexpired.ordered
      updates = updates.where(status: "published") unless preview
      events = nightly_events(campaign)
      polls = schedule ? relevant_polls(@tournament, games).to_a : []

      {
        tournament: @tournament.api_json,
        date: @day.iso8601,
        requestedDate: @day.iso8601,
        resolvedDate: @day.iso8601,
        nextScheduledDate: next_date&.iso8601,
        isRestDay: schedule && games.empty?,
        alerts: alerts.map(&:api_json),
        games: games.map { |game| game.api_json(include_rosters: true) },
        gameDayNote: note&.api_json,
        linkedCampaignEvents: events.map(&:public_json),
        updates: updates.map(&:api_json),
        predictionPolls: polls.map { |poll| poll.api_json(voter_token_hash: voter_hash) },
        fallbackTicketUrl: Hafapass::EventsClient.all_tickets_url_for(campaign),
        sponsors: @tournament.sponsors.active.ordered_by_tier.limit(4).map(&:api_json),
        lastUpdatedAt: latest_updated_at(note, games, polls, alerts, updates.to_a, events.to_a)&.iso8601
      }
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

    def nightly_games
      @tournament.games
        .includes(:division_record, home_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ], away_team: [ :division_record, :roster_entries, { team_class_memberships: :class_cohort } ])
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
