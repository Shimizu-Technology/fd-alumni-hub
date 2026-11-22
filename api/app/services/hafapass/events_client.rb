require "uri"

module Hafapass
  class EventsClient
    DEFAULT_API_BASE_URL = "https://hafapass-api.onrender.com/api/v1".freeze
    DEFAULT_WEB_BASE_URL = "https://hafapass.shimizu-technology.com".freeze
    DEFAULT_CACHE_TTL_SECONDS = 300
    PER_PAGE = 50
    MAX_PAGES = 3
    OPEN_TIMEOUT_SECONDS = 2
    READ_TIMEOUT_SECONDS = 3

    class FetchError < StandardError; end

    class << self
      def api_base_url
        ENV.fetch("HAFAPASS_API_BASE_URL", DEFAULT_API_BASE_URL).to_s.strip.delete_suffix("/")
      end

      def web_base_url
        ENV.fetch("HAFAPASS_WEB_BASE_URL", DEFAULT_WEB_BASE_URL).to_s.strip.delete_suffix("/")
      end

      def cache_ttl_seconds
        value = ENV.fetch("HAFAPASS_EVENTS_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS).to_i
        value.positive? ? value : DEFAULT_CACHE_TTL_SECONDS
      end

      def fetch_remote(organizer_slug)
        slug = organizer_slug.to_s.strip.downcase
        raise FetchError, "Invalid organizer slug" unless slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        collected = []
        page = 1

        while page <= MAX_PAGES
          query = URI.encode_www_form(
            organizer: slug,
            per_page: PER_PAGE,
            page: page,
            include_sold_out: "true"
          )
          url = "#{api_base_url}/events?#{query}"

          response = HTTParty.get(
            url,
            headers: { "Accept" => "application/json" },
            open_timeout: OPEN_TIMEOUT_SECONDS,
            read_timeout: READ_TIMEOUT_SECONDS
          )

          raise FetchError, "HTTP #{response.code}" unless response.success?

          parsed = response.parsed_response
          raw_events, total_pages = extract_events_page(parsed)
          raw_events.each do |raw|
            normalized = normalize_event(raw, organizer_slug: slug)
            collected << normalized if normalized
          end

          break if total_pages.nil? || page >= total_pages || raw_events.length < PER_PAGE

          page += 1
        end

        collected
      rescue HTTParty::Error, Timeout::Error, SocketError, JSON::ParserError, Errno::ECONNREFUSED, Errno::EHOSTUNREACH => e
        raise FetchError, "#{e.class}: #{e.message}"
      end

      def refresh_snapshot!(organizer_slug)
        slug = organizer_slug.to_s.strip.downcase
        return nil unless slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        snapshot = find_or_create_snapshot(slug)
        events = fetch_remote(slug)
        snapshot.update!(
          payload_json: events,
          fetched_at: Time.current,
          refreshing_until: nil,
          last_error: nil,
          last_error_at: nil
        )
        snapshot
      rescue FetchError => e
        snapshot&.update!(
          refreshing_until: nil,
          last_error: e.message.to_s.first(240),
          last_error_at: Time.current
        )
        Rails.logger.warn("Hafapass::EventsClient refresh failed for #{slug}: #{e.message}")
        snapshot
      end

      def for_campaign(campaign, hub_events:)
        slugs = [ campaign.hafapass_organizer_slug, campaign.hafapass_tournament_organizer_slug ]
          .filter_map { |s| s.to_s.strip.downcase.presence }
          .uniq

        all_tickets_url = if campaign.hafapass_distribution_code.present?
          "#{web_base_url}/go/#{campaign.hafapass_distribution_code}"
        end

        if slugs.empty?
          return {
            events: hub_events.map(&:public_json),
            hafapass: {
              available: false,
              stale: false,
              fetchedAt: nil,
              allTicketsUrl: all_tickets_url,
              events: []
            }
          }
        end

        ttl = cache_ttl_seconds
        snapshots = slugs.map { |slug| read_or_schedule_snapshot(slug, ttl: ttl) }

        available_snapshots = snapshots.select(&:has_data?)
        any_stale = snapshots.any? { |s| s.has_data? && !s.fresh?(ttl) } ||
                    (available_snapshots.any? && available_snapshots.length < snapshots.length)
        latest_fetched_at = available_snapshots.filter_map(&:fetched_at).max

        all_hp_events = available_snapshots.flat_map { |s| Array(s.payload_json) }.uniq { |e| e["id"] }
        matched_ids = Set.new

        enriched_hub_events = hub_events.map do |hub_event|
          base = hub_event.public_json
          match = match_hafapass_event(hub_event, all_hp_events)
          if match
            matched_ids.add(match["id"])
            base.merge(
              hafapass: present_event(
                match,
                stale: any_stale,
                distribution_code: hub_event.hafapass_distribution_code,
                manual_cancelled: hub_event.status == "cancelled"
              )
            )
          else
            base
          end
        end

        unmatched_hp_events = all_hp_events
          .reject { |hp| matched_ids.include?(hp["id"]) }
          .map { |hp| present_event(hp, stale: any_stale) }

        {
          events: enriched_hub_events,
          hafapass: {
            available: available_snapshots.any?,
            stale: any_stale,
            fetchedAt: latest_fetched_at&.iso8601,
            allTicketsUrl: all_tickets_url,
            events: unmatched_hp_events
          }
        }
      end

      private

      def read_or_schedule_snapshot(slug, ttl:)
        snapshot = find_or_create_snapshot(slug)
        unless snapshot.fresh?(ttl)
          if snapshot.acquire_refresh_lease!
            Hafapass::RefreshEventsJob.perform_later(slug)
          end
        end
        snapshot
      end

      def find_or_create_snapshot(slug)
        HafapassEventSnapshot.find_or_create_by!(organizer_slug: slug)
      rescue ActiveRecord::RecordNotUnique
        HafapassEventSnapshot.find_by!(organizer_slug: slug)
      end

      def extract_events_page(parsed)
        if parsed.is_a?(Hash) && parsed["events"].is_a?(Array)
          total_pages = parsed.dig("meta", "total_pages") || parsed.dig("pagination", "total_pages")
          [ parsed["events"], total_pages&.to_i ]
        elsif parsed.is_a?(Array)
          [ parsed, 1 ]
        else
          raise FetchError, "Unexpected HafaPass events response shape"
        end
      end

      def normalize_event(raw, organizer_slug:)
        return nil unless raw.is_a?(Hash)

        id = raw["id"].to_s.strip
        slug = raw["slug"].to_s.strip.downcase
        title = raw["title"].to_s.strip
        return nil if id.blank? || title.blank?
        return nil if slug.present? && !slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        raw_ticket_types = Array(raw["ticket_types"] || raw["ticketTypes"]).select { |t| t.is_a?(Hash) }
        ticket_types = raw_ticket_types.map do |tt|
          all_in = tt["all_in_price_cents"] || tt["allInPriceCents"] || tt["price_cents"] || tt["priceCents"]
          remaining = tt["quantity_remaining"] || tt["quantityRemaining"]
          {
            "name" => tt["name"].to_s.strip,
            "allInPriceCents" => all_in.nil? ? nil : all_in.to_i,
            "quantityRemaining" => remaining.nil? ? nil : [ remaining.to_i, 0 ].max,
            "onSale" => ActiveModel::Type::Boolean.new.cast(tt.key?("on_sale") ? tt["on_sale"] : tt["onSale"]) == true
          }
        end

        prices = ticket_types.filter_map { |t| t["allInPriceCents"] }
        min_price = prices.min

        {
          "id" => id,
          "slug" => slug.presence,
          "title" => title,
          "shortDescription" => (raw["short_description"] || raw["shortDescription"]).to_s.strip.presence,
          "startsAt" => (raw["starts_at"] || raw["startsAt"]).to_s.strip.presence,
          "endsAt" => (raw["ends_at"] || raw["endsAt"]).to_s.strip.presence,
          "venueName" => (raw["venue_name"] || raw["venueName"]).to_s.strip.presence,
          "venueCity" => (raw["venue_city"] || raw["venueCity"]).to_s.strip.presence,
          "organizerSlug" => organizer_slug,
          "isPass" => ActiveModel::Type::Boolean.new.cast(raw.key?("is_pass") ? raw["is_pass"] : raw["isPass"]) == true,
          "seriesSlug" => (raw["series_slug"] || raw["seriesSlug"]).to_s.strip.presence,
          "ticketState" => derive_ticket_state(raw, ticket_types),
          "minAllInPriceCents" => min_price,
          "ticketTypes" => ticket_types
        }
      end

      def derive_ticket_state(raw, ticket_types)
        status = raw["status"].to_s.strip.downcase
        return "cancelled" if status == "cancelled"

        purchasable = ActiveModel::Type::Boolean.new.cast(raw["purchasable"]) == true
        has_remaining = ticket_types.any? { |t| t["quantityRemaining"].to_i.positive? }
        all_sold_out = ticket_types.any? && ticket_types.all? { |t| !t["quantityRemaining"].nil? && t["quantityRemaining"].to_i <= 0 }

        return "sold_out" if all_sold_out
        return "on_sale" if purchasable || (ticket_types.any? { |t| t["onSale"] } && has_remaining)

        starts_at_raw = raw["starts_at"] || raw["startsAt"]
        parsed_start = starts_at_raw.present? ? Time.zone.parse(starts_at_raw.to_s) : nil
        return "upcoming" if parsed_start && parsed_start > Time.current

        "sales_ended"
      rescue ArgumentError
        "sales_ended"
      end

      def match_hafapass_event(hub_event, hp_events)
        if hub_event.hafapass_event_id.present?
          by_id = hp_events.find { |hp| hp["id"].to_s == hub_event.hafapass_event_id.to_s }
          return by_id if by_id
        end

        if hub_event.hafapass_event_slug.present?
          return hp_events.find { |hp| hp["slug"].to_s == hub_event.hafapass_event_slug.to_s }
        end

        nil
      end

      def present_event(hp, stale:, distribution_code: nil, manual_cancelled: false)
        effective_state = manual_cancelled ? "cancelled" : hp["ticketState"]
        buy_url = build_buy_url(hp["slug"], distribution_code: distribution_code)

        {
          id: hp["id"],
          slug: hp["slug"],
          title: hp["title"],
          shortDescription: hp["shortDescription"],
          startsAt: hp["startsAt"],
          endsAt: hp["endsAt"],
          venueName: hp["venueName"],
          venueCity: hp["venueCity"],
          organizerSlug: hp["organizerSlug"],
          isPass: hp["isPass"] == true,
          seriesSlug: hp["seriesSlug"],
          ticketState: effective_state,
          minAllInPriceCents: stale ? nil : hp["minAllInPriceCents"],
          ticketTypes: stale ? [] : Array(hp["ticketTypes"]),
          availabilityLabel: stale ? "Check availability on HåfaPass" : nil,
          buyUrl: buy_url
        }
      end

      def build_buy_url(slug, distribution_code: nil)
        code = distribution_code.to_s.strip.downcase
        if code.present? && code.match?(HostCampaign::HAFAPASS_CODE_FORMAT)
          return "#{web_base_url}/go/#{code}"
        end

        safe_slug = slug.to_s.strip.downcase
        return nil unless safe_slug.present? && safe_slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        "#{web_base_url}/events/#{safe_slug}"
      end
    end
  end
end
