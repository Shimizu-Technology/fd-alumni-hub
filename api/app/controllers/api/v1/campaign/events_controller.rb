module Api
  module V1
    module Campaign
      class EventsController < BaseController
        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "view", "board", "chair", "treasurer") }, only: :index
        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "edit", "chair") }, only: :create
        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "edit", "chair") }, only: :update
        before_action -> { require_campaign_access!("fundraisers_and_sponsors", "edit", "chair") }, only: :archive
        before_action :require_campaign_writable!, only: [ :create, :update, :archive ]

        def index
          events = @campaign.campaign_events.ordered
          events = events.not_archived unless ActiveModel::Type::Boolean.new.cast(params[:includeArchived])
          render json: { events: events.map(&:admin_json) }
        end

        def create
          event = @campaign.campaign_events.build(event_params)
          require_campaign_access!("fundraisers_and_sponsors", "publish", "chair") if event.public_visible?
          return if performed?

          CampaignEvent.transaction do
            unless event.save
              render_errors(event)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: event, action: "create_event", changes: { "title" => event.title, "kind" => event.kind })
          end
          return if performed?

          render json: { event: event.admin_json }, status: :created
        end

        def update
          event = @campaign.campaign_events.find(params[:id])
          event.assign_attributes(event_params)
          require_campaign_access!("fundraisers_and_sponsors", "publish", "chair") if event.will_save_change_to_public_visible?
          return if performed?

          CampaignEvent.transaction do
            changes = event.changes
            unless event.save
              render_errors(event)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: event, action: "update_event", changes: changes) if changes.any?
          end
          return if performed?

          render json: { event: event.admin_json }
        end

        def archive
          event = @campaign.campaign_events.find(params[:id])
          return render json: { event: event.admin_json } if event.archived?

          CampaignEvent.transaction do
            event.update!(archived_at: Time.current)
            record_audit!(record: event, action: "archive_event", changes: { "archived_at" => event.archived_at.iso8601 })
          end

          render json: { event: event.admin_json }
        end

        private

        def event_params
          raw = params.fetch(:event, params)
          permitted = raw.permit(
            :kind, :title,
            :starts_at, :startsAt,
            :ends_at, :endsAt,
            :date_label, :dateLabel,
            :venue, :description,
            :image_url, :imageUrl,
            :hafapass_event_id, :hafapassEventId,
            :hafapass_event_slug, :hafapassEventSlug,
            :hafapass_distribution_code, :hafapassDistributionCode,
            :external_url, :externalUrl,
            :cta_label, :ctaLabel,
            :status,
            :public_visible, :publicVisible,
            :goal_cents, :goalCents,
            :position,
            :recap_notes, :recapNotes, :recap_highlights, :recapHighlights, :raised_display, :raisedDisplay,
            recap_photos: [ :url, :caption ], recapPhotos: [ :url, :caption ]
          )

          attrs = {}
          assign_param(attrs, permitted, :kind, :kind)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :starts_at, :starts_at, :startsAt)
          assign_param(attrs, permitted, :ends_at, :ends_at, :endsAt)
          assign_param(attrs, permitted, :date_label, :date_label, :dateLabel)
          assign_param(attrs, permitted, :venue, :venue)
          assign_param(attrs, permitted, :description, :description)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :hafapass_event_id, :hafapass_event_id, :hafapassEventId)
          assign_param(attrs, permitted, :hafapass_event_slug, :hafapass_event_slug, :hafapassEventSlug)
          assign_param(attrs, permitted, :hafapass_distribution_code, :hafapass_distribution_code, :hafapassDistributionCode)
          assign_param(attrs, permitted, :external_url, :external_url, :externalUrl)
          assign_param(attrs, permitted, :cta_label, :cta_label, :ctaLabel)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :public_visible, :public_visible, :publicVisible)
          assign_param(attrs, permitted, :goal_cents, :goal_cents, :goalCents)
          assign_param(attrs, permitted, :position, :position)
          assign_param(attrs, permitted, :recap_notes, :recap_notes, :recapNotes)
          assign_param(attrs, permitted, :recap_highlights, :recap_highlights, :recapHighlights)
          assign_param(attrs, permitted, :raised_display, :raised_display, :raisedDisplay)
          photo_key = %i[recap_photos recapPhotos].find { |key| raw.key?(key) }
          attrs[:recap_photos] = recap_photos_param(photo_key, raw[photo_key], permitted[photo_key]) if photo_key
          attrs
        end

        def recap_photos_param(photo_key, raw_photos, permitted_photos)
          # Check unmunged JSON when available because Rails deep-munge strips [null] into [].
          unmunged = unmunged_recap_photos(photo_key)
          if !unmunged.nil?
            return unless unmunged.is_a?(Array) && unmunged.all? { |photo| photo.is_a?(Hash) &&
              photo["url"].is_a?(String) && (photo["caption"].nil? || photo["caption"].is_a?(String)) }

            return permitted_photos.is_a?(Array) ? permitted_photos.map(&:to_h) : []
          end

          # Strong parameters drop malformed entries. Preserve rejection of the entire update.
          return unless raw_photos.is_a?(Array) && raw_photos.all? { |photo| photo.is_a?(ActionController::Parameters) &&
            photo[:url].is_a?(String) && (photo[:caption].nil? || photo[:caption].is_a?(String)) }

          permitted_photos.map(&:to_h)
        end

        def unmunged_recap_photos(photo_key)
          return nil unless request.content_mime_type&.json?

          raw_body = request.raw_post
          return nil if raw_body.blank?

          parsed = JSON.parse(raw_body)
          container = parsed.is_a?(Hash) && parsed["event"].is_a?(Hash) ? parsed["event"] : parsed
          return nil unless container.is_a?(Hash) && container.key?(photo_key.to_s)

          container[photo_key.to_s]
        rescue JSON::ParserError
          nil
        end
      end
    end
  end
end
