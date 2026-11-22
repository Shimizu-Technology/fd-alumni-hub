module Api
  module V1
    module Admin
      class SiteModeController < BaseController
        CAPABILITY = "site_mode_and_settings"

        skip_before_action :authenticate_user!, only: :preview
        before_action :authenticate_preview_user!, only: :preview

        rescue_from ActiveRecord::RecordInvalid do |error|
          render_errors(error.record)
        end

        def show
          return unless authorize!(CAPABILITY, "view")

          resolver = SiteMode::Resolver.new
          counts = Game.group(:tournament_id).count
          render json: {
            current: resolver.publication&.api_json,
            siteMode: resolver.as_json,
            history: SitePublication.includes(:published_by).order(version_number: :desc).limit(20).map(&:api_json),
            tournaments: Tournament.order(year: :desc, start_date: :desc).map do |season|
              season.api_json.merge(schedulePublished: season.publicly_visible_schedule?, gameCount: counts.fetch(season.id, 0))
            end,
            campaigns: HostCampaign.includes(:class_cohort).order(:title).map do |campaign|
              { id: campaign.id.to_s, title: campaign.title, status: campaign.status, slug: campaign.slug, hostClass: campaign.class_cohort&.display_name }
            end,
            readiness: resolver.readiness,
            suggestedMode: resolver.suggested_mode,
            actions: %w[publish restore].select { |action| access_policy.allows?(CAPABILITY, action) }
          }
        end

        def preview
          response.headers["Cache-Control"] = "no-store"
          return unless authorize!(CAPABILITY, "view")

          proposed = SiteMode::Resolver.preview(**settings, publish_schedule: publish_schedule?)
          return render_errors(proposed.publication) unless proposed.publication.valid?(:preview)

          live = SiteMode::Resolver.new
          before = live.sections
          after = proposed.sections
          render json: {
            previewSiteMode: proposed.as_json,
            changes: {
              appearing: after.keys.select { |key| after[key] && !before[key] },
              disappearing: before.keys.select { |key| before[key] && !after[key] }
            },
            warnings: proposed.readiness.fetch(proposed.mode.to_sym)
          }
        end

        def publish
          return unless authorize!(CAPABILITY, "publish")

          respond_with_publication(settings, publish_schedule: publish_schedule?)
        end

        def restore
          return unless authorize!(CAPABILITY, "restore")

          source = SitePublication.find(params[:publicationId])
          respond_with_publication(source.slice(*SitePublication::SETTINGS), restored_from: source)
        end

        private

        def authenticate_preview_user!
          authenticate_user_optional
          render_unauthorized("Sign in to preview Site Mode") unless current_user
        end

        def settings
          {
            mode: params[:mode],
            tournament_id: find_selection(Tournament, :tournamentId),
            host_campaign_id: find_selection(HostCampaign, :hostCampaignId),
            section_overrides: params.fetch(:sectionOverrides, {}).as_json,
            recap_headline: params[:recapHeadline],
            recap_summary: params[:recapSummary],
            handoff_banner_enabled: ActiveModel::Type::Boolean.new.cast(params[:handoffBannerEnabled]) == true
          }
        end

        def find_selection(model, key)
          model.find(params[key]).id if params[key].present?
        end

        def publish_schedule?
          ActiveModel::Type::Boolean.new.cast(params[:publishSchedule]) == true
        end

        def respond_with_publication(settings, restored_from: nil, publish_schedule: false)
          publication = Audit::Context.with(actor: current_user) do
            SitePublication.transaction(requires_new: true) do
              # Serialize version assignment even when there is no previous publication to lock.
              SitePublication.connection.execute("LOCK TABLE site_publications IN EXCLUSIVE MODE")
              Audit::Context.apply_to_transaction!(SitePublication.connection)
              version = SitePublication.maximum(:version_number).to_i + 1
              SitePublication.current&.update!(current: false)
              record = SitePublication.create!(
                **settings.symbolize_keys, version_number: version, current: true,
                published_by: current_user, published_at: Time.current, restored_from: restored_from
              )
              if publish_schedule && (season = record.tournament)
                season.with_lock do
                  season.schedule_published_at ||= Time.current
                  season.schedule_revision += 1
                  season.save!
                end
              end
              record
            end
          end
          render json: { current: publication.api_json, siteMode: SiteMode::Resolver.new(publication: publication).as_json }, status: :created
        end
      end
    end
  end
end
