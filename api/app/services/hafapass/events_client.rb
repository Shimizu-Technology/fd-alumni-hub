require "uri"
require "time"

module Hafapass
  class EventsClient
    DEFAULT_API_BASE_URL = "https://hafapass-api.onrender.com/api/v1".freeze
    DEFAULT_WEB_BASE_URL = "https://hafapass.shimizu-technology.com".freeze
    DEFAULT_CACHE_TTL_SECONDS = 300
    DEFAULT_ERROR_BACKOFF_SECONDS = 30
    PER_PAGE = 50
    MAX_PAGES = 3
    OPEN_TIMEOUT_SECONDS = 2
    READ_TIMEOUT_SECONDS = 3
    REFRESH_DEADLINE_SECONDS = 12.0
    MAX_RESPONSE_BYTES = 1_048_576 # 1 MiB per page
    MAX_TITLE_LENGTH = 180
    MAX_DESCRIPTION_LENGTH = 500
    MAX_SHORT_TEXT_LENGTH = 120

    class FetchError < StandardError; end

    class << self
      def api_base_url
        raw = ENV.fetch("HAFAPASS_API_BASE_URL", DEFAULT_API_BASE_URL).to_s.strip.delete_suffix("/")
        safe_base_url(raw, fallback: DEFAULT_API_BASE_URL)
      end

      def web_base_url
        raw = ENV.fetch("HAFAPASS_WEB_BASE_URL", DEFAULT_WEB_BASE_URL).to_s.strip.delete_suffix("/")
        safe_base_url(raw, fallback: DEFAULT_WEB_BASE_URL)
      end

      def cache_ttl_seconds
        value = parse_non_negative_int(ENV["HAFAPASS_EVENTS_CACHE_TTL_SECONDS"])
        value&.positive? ? value : DEFAULT_CACHE_TTL_SECONDS
      end

      def error_backoff_seconds
        value = parse_non_negative_int(ENV["HAFAPASS_ERROR_BACKOFF_SECONDS"])
        value.nil? ? DEFAULT_ERROR_BACKOFF_SECONDS : value
      end

      def all_tickets_url_for(campaign)
        code = campaign&.hafapass_distribution_code.to_s.strip.downcase
        return nil unless code.present? && code.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        "#{web_base_url}/go/#{code}"
      end

      def fetch_remote(organizer_slug, http_get: nil)
        slug = organizer_slug.to_s.strip.downcase
        raise FetchError, "Invalid organizer slug" unless slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        requester = http_get || HTTParty.method(:get)
        deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + REFRESH_DEADLINE_SECONDS
        collected = []
        page = 1

        while page <= MAX_PAGES
          remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
          raise FetchError, "HafaPass refresh exceeded deadline" if remaining <= 0

          query = URI.encode_www_form(
            organizer: slug,
            per_page: PER_PAGE,
            page: page,
            include_sold_out: "true"
          )
          url = "#{api_base_url}/events?#{query}"

          response = requester.call(
            url,
            headers: { "Accept" => "application/json" },
            open_timeout: [ OPEN_TIMEOUT_SECONDS, remaining ].min,
            read_timeout: [ READ_TIMEOUT_SECONDS, remaining ].min,
            follow_redirects: false
          )

          raise FetchError, "HTTP #{response.code}" unless response.success?

          if response.respond_to?(:body) && response.body.is_a?(String) && response.body.bytesize > MAX_RESPONSE_BYTES
            raise FetchError, "HafaPass response exceeded size limit"
          end

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
      rescue FetchError
        raise
      rescue StandardError => e
        raise FetchError, "#{e.class}: #{e.message}"
      end

      def refresh_snapshot!(organizer_slug, http_get: nil)
        slug = organizer_slug.to_s.strip.downcase
        return nil unless slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        snapshot = find_or_create_snapshot(slug)
        events = fetch_remote(slug, http_get: http_get)
        snapshot.update!(
          payload_json: events,
          fetched_at: Time.current,
          refreshing_until: nil,
          last_error: nil,
          last_error_at: nil
        )
        snapshot
      rescue FetchError => e
        record_refresh_error(snapshot, slug, e.message.to_s)
        snapshot
      rescue StandardError => e
        record_refresh_error(snapshot, slug, "#{e.class}: #{e.message}")
        snapshot
      end

      def for_campaign(campaign, hub_events:)
        slugs = [ campaign.hafapass_organizer_slug, campaign.hafapass_tournament_organizer_slug ]
          .filter_map { |s| s.to_s.strip.downcase.presence }
          .uniq

        all_tickets_url = all_tickets_url_for(campaign)

        if slugs.empty?
          return fallback_payload(hub_events: hub_events, all_tickets_url: all_tickets_url)
        end

        ttl = cache_ttl_seconds
        backoff = error_backoff_seconds
        snapshots = slugs.map { |slug| read_or_schedule_snapshot(slug, ttl: ttl, backoff: backoff) }

        available_snapshots = snapshots.select(&:has_data?)
        any_stale = snapshots.any? { |s| s.has_data? && !s.fresh?(ttl) } ||
                    (available_snapshots.any? && available_snapshots.length < snapshots.length)
        latest_fetched_at = available_snapshots.filter_map(&:fetched_at).max

        all_hp_entries = []
        seen_ids = Set.new
        available_snapshots.each do |snapshot|
          snapshot_stale = !snapshot.fresh?(ttl)
          Array(snapshot.payload_json).each do |hp|
            next unless hp.is_a?(Hash) && hp["id"].present?
            next if seen_ids.include?(hp["id"])

            seen_ids.add(hp["id"])
            all_hp_entries << { event: hp, stale: snapshot_stale }
          end
        end

        matched_ids = Set.new

        enriched_hub_events = hub_events.map do |hub_event|
          base = hub_event.public_json
          match_entry = match_hafapass_entry(hub_event, all_hp_entries)
          if match_entry
            match = match_entry[:event]
            matched_ids.add(match["id"])
            base.merge(
              hafapass: present_event(
                match,
                stale: match_entry[:stale],
                distribution_code: hub_event.hafapass_distribution_code,
                manual_cancelled: hub_event.status == "cancelled"
              )
            )
          else
            base
          end
        end

        unmatched_hp_events = all_hp_entries
          .reject { |entry| matched_ids.include?(entry[:event]["id"]) }
          .map { |entry| present_event(entry[:event], stale: entry[:stale]) }

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

      def fallback_payload(hub_events:, all_tickets_url: nil)
        {
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

      private

      def safe_base_url(raw, fallback:)
        uri = URI.parse(raw)
        return raw if uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.nil?
        if (Rails.env.development? || Rails.env.test?) && uri.is_a?(URI::HTTP) && %w[localhost 127.0.0.1].include?(uri.host)
          return raw
        end

        fallback
      rescue URI::InvalidURIError
        fallback
      end

      def parse_non_negative_int(value)
        if value.is_a?(Integer)
          return value.negative? ? nil : value
        end
        return nil unless value.is_a?(String)

        trimmed = value.strip
        return nil if trimmed.empty?

        parsed = Integer(trimmed, 10, exception: false)
        return nil if parsed.nil? || parsed.negative?

        parsed
      end

      def parse_iso8601_or_nil(value)
        return nil unless value.is_a?(String) || value.is_a?(Time) || value.is_a?(ActiveSupport::TimeWithZone)
        return value.iso8601 if value.respond_to?(:iso8601)

        trimmed = value.strip
        return nil if trimmed.empty?

        Time.iso8601(trimmed).iso8601
      rescue ArgumentError
        parsed = Time.zone.parse(trimmed)
        parsed&.iso8601
      rescue ArgumentError
        nil
      end

      def truncate_text(value, max_length)
        return nil unless value.is_a?(String) || value.is_a?(Numeric)

        cleaned = value.to_s.strip
        return nil if cleaned.empty?

        cleaned.first(max_length)
      end

      def record_refresh_error(snapshot, slug, message)
        begin
          snapshot&.update!(
            refreshing_until: nil,
            last_error: message.first(240),
            last_error_at: Time.current
          )
        rescue StandardError => update_err
          Rails.logger.error("Hafapass::EventsClient failed recording error for #{slug}: #{update_err.class}: #{update_err.message}")
        end
        Rails.logger.warn("Hafapass::EventsClient refresh failed for #{slug}: #{message}")
      end

      def read_or_schedule_snapshot(slug, ttl:, backoff:)
        snapshot = find_or_create_snapshot(slug)
        if !snapshot.fresh?(ttl) && !snapshot.in_error_backoff?(backoff)
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
          raw_total = parsed.dig("meta", "total_pages") || parsed.dig("pagination", "total_pages")
          total_pages = parse_non_negative_int(raw_total)
          total_pages = nil unless total_pages&.positive?
          [ parsed["events"], total_pages ]
        elsif parsed.is_a?(Array)
          [ parsed, 1 ]
        else
          raise FetchError, "Unexpected HafaPass events response shape"
        end
      end

      def normalize_event(raw, organizer_slug:)
        return nil unless raw.is_a?(Hash)

        event_organizer = (
          raw["organizer_slug"] ||
          raw["organizerSlug"] ||
          (raw["organizer"].is_a?(Hash) ? raw["organizer"]["slug"] : nil)
        ).to_s.strip.downcase
        return nil unless event_organizer == organizer_slug

        id = raw["id"].to_s.strip
        slug = raw["slug"].to_s.strip.downcase
        title = truncate_text(raw["title"], MAX_TITLE_LENGTH)
        return nil if id.blank? || title.blank?
        return nil unless id.match?(CampaignEvent::HAFAPASS_ID_FORMAT)
        return nil if slug.present? && !slug.match?(HostCampaign::HAFAPASS_CODE_FORMAT)

        raw_ticket_types = Array(raw["ticket_types"] || raw["ticketTypes"]).select { |t| t.is_a?(Hash) }
        ticket_types = raw_ticket_types.map do |tt|
          all_in = tt["all_in_price_cents"] || tt["allInPriceCents"] || tt["price_cents"] || tt["priceCents"]
          remaining = tt["quantity_remaining"] || tt["quantityRemaining"]
          {
            "name" => truncate_text(tt["name"], MAX_SHORT_TEXT_LENGTH).to_s,
            "allInPriceCents" => parse_non_negative_int(all_in),
            "quantityRemaining" => parse_non_negative_int(remaining),
            "onSale" => ActiveModel::Type::Boolean.new.cast(tt.key?("on_sale") ? tt["on_sale"] : tt["onSale"]) == true
          }
        end

        prices = ticket_types.filter_map { |t| t["allInPriceCents"] }
        min_price = prices.min
        starts_at = parse_iso8601_or_nil(raw["starts_at"] || raw["startsAt"])
        ends_at = parse_iso8601_or_nil(raw["ends_at"] || raw["endsAt"])

        {
          "id" => id,
          "slug" => slug.presence,
          "title" => title,
          "shortDescription" => truncate_text(raw["short_description"] || raw["shortDescription"], MAX_DESCRIPTION_LENGTH),
          "startsAt" => starts_at,
          "endsAt" => ends_at,
          "venueName" => truncate_text(raw["venue_name"] || raw["venueName"], MAX_SHORT_TEXT_LENGTH),
          "venueCity" => truncate_text(raw["venue_city"] || raw["venueCity"], MAX_SHORT_TEXT_LENGTH),
          "organizerSlug" => organizer_slug,
          "isPass" => ActiveModel::Type::Boolean.new.cast(raw.key?("is_pass") ? raw["is_pass"] : raw["isPass"]) == true,
          "seriesSlug" => truncate_text(raw["series_slug"] || raw["seriesSlug"], MAX_SHORT_TEXT_LENGTH),
          "ticketState" => derive_ticket_state(raw, ticket_types, starts_at: starts_at),
          "minAllInPriceCents" => min_price,
          "ticketTypes" => ticket_types
        }
      end

      def derive_ticket_state(raw, ticket_types, starts_at: nil)
        status = raw["status"].to_s.strip.downcase
        return "cancelled" if %w[cancelled canceled].include?(status)

        all_sold_out = ticket_types.any? && ticket_types.all? { |t| !t["quantityRemaining"].nil? && t["quantityRemaining"] <= 0 }
        return "sold_out" if all_sold_out

        if raw.key?("purchasable")
          purchasable = ActiveModel::Type::Boolean.new.cast(raw["purchasable"]) == true
          return "on_sale" if purchasable
        else
          has_purchasable_type = ticket_types.any? do |t|
            t["onSale"] && (t["quantityRemaining"].nil? || t["quantityRemaining"].positive?)
          end
          return "on_sale" if has_purchasable_type
        end

        parsed_start = starts_at.present? ? Time.iso8601(starts_at) : nil
        return "upcoming" if parsed_start && parsed_start > Time.current && (status.blank? || status == "published")

        "sales_ended"
      rescue ArgumentError
        "sales_ended"
      end

      def match_hafapass_entry(hub_event, hp_entries)
        if hub_event.hafapass_event_id.present?
          return hp_entries.find { |entry| entry[:event]["id"].to_s == hub_event.hafapass_event_id.to_s }
        end

        if hub_event.hafapass_event_slug.present?
          return hp_entries.find { |entry| entry[:event]["slug"].to_s == hub_event.hafapass_event_slug.to_s }
        end

        nil
      end

      def present_event(hp, stale:, distribution_code: nil, manual_cancelled: false)
        effective_state = if manual_cancelled
          "cancelled"
        elsif stale
          hp["ticketState"] == "cancelled" ? "cancelled" : nil
        else
          hp["ticketState"]
        end
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
