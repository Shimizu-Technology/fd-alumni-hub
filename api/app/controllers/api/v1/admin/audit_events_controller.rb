module Api
  module V1
    module Admin
      class AuditEventsController < BaseController
        skip_before_action :require_staff!
        before_action :require_admin!

        TEXT_FILTERS = %i[area action record_type record_id operation_id].freeze
        ID_FILTERS = %i[actor_id tournament_id host_campaign_id].freeze
        SEARCH_FIELDS = %w[summary record_label actor_name actor_email reason record_type record_id operation_id].freeze

        def index
          response.headers["Cache-Control"] = "no-store"
          limit = params[:limit].nil? ? 50 : integer_param(params[:limit]).clamp(1, 100)
          events = filtered_events.order(occurred_at: :desc, id: :desc).limit(limit + 1).to_a
          has_more = events.length > limit
          events.pop if has_more

          render json: {
            auditEvents: events.map(&:api_json),
            nextCursor: has_more ? encode_cursor(events.last) : nil,
            filterOptions: filter_options
          }
        rescue ArgumentError, RangeError
          render json: { error: "Invalid audit history filter or cursor." }, status: :bad_request
        end

        private

        def filtered_events
          filters = request.query_parameters.slice(*TEXT_FILTERS.map(&:to_s)).select { |_, value| value.is_a?(String) && value.present? }
          ID_FILTERS.each { |key| filters[key] = integer_param(params[key]) if params[key].present? }
          scope = AuditEvent.where(filters)
          if params[:q].present?
            term = "%#{AuditEvent.sanitize_sql_like(params[:q].to_s.strip)}%"
            scope = scope.where(SEARCH_FIELDS.map { |field| "#{field} ILIKE :term" }.join(" OR "), term: term)
          end
          scope = scope.where("occurred_at >= ?", date_boundary(params[:from])) if params[:from].present?
          if params[:to].present?
            date_only = params[:to].to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
            scope = scope.where(date_only ? "occurred_at < ?" : "occurred_at <= ?", date_boundary(params[:to], next_day: date_only))
          end
          if params[:cursor].present?
            timestamp, id = decode_cursor(params[:cursor])
            scope = scope.where("(occurred_at, id) < (?, ?)", timestamp, id)
          end
          scope
        end

        def integer_param(value)
          id = Integer(value.to_s, 10)
          raise ArgumentError unless id.between?(1, 2**63 - 1)

          id
        end

        def date_boundary(value, next_day: false)
          if value.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
            date = Date.iso8601(value)
            date = date.next_day if next_day
            Time.zone.local(date.year, date.month, date.day)
          else
            Time.iso8601(value.to_s)
          end
        end

        def encode_cursor(event)
          Base64.urlsafe_encode64("#{event.occurred_at.iso8601(6)}|#{event.id}", padding: false)
        end

        def decode_cursor(value)
          raise ArgumentError unless value.is_a?(String) && value.bytesize <= 128

          timestamp, id = Base64.urlsafe_decode64(value).split("|", 2)
          [ Time.iso8601(timestamp.to_s), integer_param(id) ]
        end

        def filter_options
          actor_rows = AuditEvent.where.not(actor_id: nil)
            .select("DISTINCT ON (actor_id) actor_id, actor_name, actor_email")
            .order(:actor_id, occurred_at: :desc, id: :desc)
          actors = actor_rows.map do |event|
            { id: event.actor_id.to_s, label: event.actor_name.presence || event.actor_email.presence || "Unavailable" }
          end
          campaigns = HostCampaign.pluck(:id, :title).to_h
          tournaments = Tournament.pluck(:id, :year, :name).to_h { |id, year, name| [ id, "#{year} · #{name}" ] }
          {
            areas: AuditEvent.distinct.order(:area).pluck(:area),
            actors: actors.sort_by { |actor| actor[:label].downcase },
            tournaments: scope_options(:tournament_id, tournaments, "Season"),
            campaigns: scope_options(:host_campaign_id, campaigns, "Campaign")
          }
        end

        def scope_options(column, labels, fallback)
          AuditEvent.where.not(column => nil).distinct.pluck(column).map do |id|
            { id: id.to_s, label: labels.fetch(id, "#{fallback} ##{id}") }
          end.sort_by { |option| option[:label].downcase }
        end
      end
    end
  end
end
