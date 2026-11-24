module HostCampaigns
  class PublicShowcase
    def initialize(campaign, mode: nil)
      @campaign = campaign
      @mode = mode
    end

    def as_json(*)
      posts = @campaign.campaign_posts.published.includes(:author).ordered.limit(50)
      merged = with_tickets(@campaign.campaign_events.public_listing.ordered.to_a)
      merged.merge(campaign: @campaign.public_json, posts: posts.map(&:public_json))
    end

    def with_tickets(events)
      merged = Hafapass::EventsClient.for_campaign(@campaign, hub_events: events)
      return merged unless @mode == "fundraising"

      hafapass = merged.fetch(:hafapass)
      merged.merge(hafapass: hafapass.merge(events: hafapass.fetch(:events).reject { |event| tournament_event?(event) }))
    rescue StandardError => e
      Rails.logger.warn("HafaPass fallback for campaign #{@campaign.id}: #{e.class}: #{e.message}")
      Hafapass::EventsClient.fallback_payload(
        hub_events: events,
        all_tickets_url: Hafapass::EventsClient.all_tickets_url_for(@campaign)
      )
    end

    private

    def tournament_event?(event)
      tournament_slug = @campaign.hafapass_tournament_organizer_slug
      event[:isPass] == true ||
        (tournament_slug.present? && tournament_slug != @campaign.hafapass_organizer_slug && event[:organizerSlug] == tournament_slug)
    end
  end
end
