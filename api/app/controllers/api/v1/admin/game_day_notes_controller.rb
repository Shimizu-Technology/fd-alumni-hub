module Api
  module V1
    module Admin
      class GameDayNotesController < BaseController
        CAPABILITY = "tonights_menu_and_news"
        class InvalidDateParam < StandardError; end

        rescue_from InvalidDateParam, with: :render_invalid_date

        def index
          return unless authorize_tournament!(CAPABILITY, "view", tournament&.id)

          date = requested_date
          note = tournament.game_day_notes.find_by(date: date)
          games = tournament.games.includes(:division_record, home_team: :division_record, away_team: :division_record).where(start_time: date.all_day).ordered

          render json: {
            tournament: tournament.api_json, date: date.iso8601, gameDayNote: note&.api_json,
            games: games.map(&:api_json), predictionPolls: prediction_polls_for_admin.map(&:api_json),
            infoGuide: Tonight::InfoGuide.for(tournament)
          }
        end

        def create
          return unless authorize_tournament!(CAPABILITY, "view", tournament&.id)

          raw = raw_note_params
          date = parse_date(raw[:date].presence || params[:date].presence || Time.zone.today.iso8601)
          note = tournament.game_day_notes.find_or_initialize_by(date: date)
          persist(note, note_params)
        rescue ActiveRecord::RecordNotUnique
          conflict(tournament.game_day_notes.find_by!(date: date))
        end

        def update
          note = GameDayNote.find(params[:id])
          return unless authorize_record_season!(CAPABILITY, "view", note.tournament_id, tournament)

          parse_date(raw_note_params[:date]) if raw_note_params[:date].present?
          persist(note, note_params)
        end

        def copy_previous
          return unless authorize_tournament!(CAPABILITY, "edit", tournament&.id)

          date = requested_date
          previous = tournament.game_day_notes.where(date: ...date)
            .where("menu_items <> '[]'::jsonb OR NULLIF(BTRIM(food_menu), '') IS NOT NULL").ordered.first
          unless previous
            return render json: { errors: [ "No earlier menu is available to copy" ] }, status: :unprocessable_entity
          end

          note = tournament.game_day_notes.find_or_initialize_by(date: date)
          return conflict(note) if note.persisted? && note.status == "published"

          spotlight = note.host_spotlight.presence || previous.host_spotlight
          persist(note, { menu_items: previous.menu_items, food_menu: previous.food_menu, host_spotlight: spotlight, status: "draft" })
        rescue ActiveRecord::RecordNotUnique
          conflict(tournament.game_day_notes.find_by!(date: date))
        end

        def preview
          response.headers["Cache-Control"] = "no-store"
          return unless authorize_tournament!(CAPABILITY, "view", tournament&.id)

          render json: Tonight::Payload.call(tournament: tournament, day: requested_date, preview: true,
            campaign: Tonight::Payload.campaign_for(tournament),
            alerts: SiteMode::Resolver.new.alerts(tournament).to_a)
        end

        def info_guide
          site_editor = access_policy.allows?("site_mode_and_settings", "edit")
          season = site_editor ? admin_tournament("site_mode_and_settings") : tournament
          return render_forbidden unless season
          return unless site_editor || authorize_tournament!(CAPABILITY, "publish", season.id)

          guide = params[:infoGuide]
          guide = guide.to_unsafe_h.to_h if guide.is_a?(ActionController::Parameters)
          season.with_lock do
            guide = season.info_guide_json.merge(guide) if guide.is_a?(Hash)
            if season.update(info_guide_json: guide)
              render json: { infoGuide: Tonight::InfoGuide.for(season) }
            else
              render_errors(season)
            end
          end
        end

        private

        def tournament
          admin_tournament(CAPABILITY)
        end

        def persist(note, attrs)
          already_published = note.persisted? && note.status == "published"
          action = already_published || attrs[:status] == "published" ? "publish" : "edit"
          return unless authorize_tournament!(CAPABILITY, action, note.tournament_id)

          raw = raw_note_params
          version_key = %i[lockVersion lock_version].find { |key| raw.key?(key) }
          if version_key
            version = raw[version_key]
            matches = note.persisted? ? version.to_s == note.lock_version.to_s : version.nil?
            return conflict(note) unless matches
          end

          attrs[:status] = "draft" if note.new_record? && !attrs.key?(:status)
          created = note.new_record?
          if note.update(attrs)
            render_record(note, key: :gameDayNote, status: created ? :created : :ok)
          elsif created && note.errors.of_kind?(:date, :taken)
            conflict(tournament.game_day_notes.find_by!(date: note.date))
          else
            render_errors(note)
          end
        rescue ActiveRecord::StaleObjectError
          conflict(note.reload)
        end

        def conflict(note)
          render json: { errors: [ "This night changed since you opened it. Reload the current note before saving." ], currentNote: note.api_json }, status: :conflict
        end

        def prediction_polls_for_admin
          tournament.prediction_polls
            .includes(:prediction_votes, { tournament: { teams: :division_record } }, game: [ { home_team: :division_record }, { away_team: :division_record } ])
            .ordered
        end

        def requested_date
          parse_date(params[:date].presence || Time.zone.today.iso8601)
        end

        def raw_note_params
          raw = params.fetch(:gameDayNote, params.fetch(:game_day_note, params))
          raise ActionController::ParameterMissing, :gameDayNote unless raw.is_a?(ActionController::Parameters)

          raw
        end

        def note_params
          raw = raw_note_params
          permitted = raw.permit(:host_class, :hostClass, :food_menu, :foodMenu, :announcement, :sponsor_shoutout, :sponsorShoutout, :active)

          attrs = {}
          assign_param(attrs, permitted, :host_class, :host_class, :hostClass)
          assign_param(attrs, permitted, :food_menu, :food_menu, :foodMenu)
          assign_param(attrs, permitted, :announcement, :announcement)
          assign_param(attrs, permitted, :sponsor_shoutout, :sponsor_shoutout, :sponsorShoutout)
          assign_param(attrs, permitted, :active, :active)
          attrs[:status] = raw[:status] if raw.key?(:status)
          structured = raw.to_unsafe_h
          { menu_items: :menuItems, special_events: :specialEvents, host_spotlight: :hostSpotlight }.each do |column, key|
            next unless raw.key?(key) || raw.key?(column)

            # Validate the full shape in the model so invalid or private keys are rejected.
            attrs[column] = structured.fetch(key) { structured[column] }
          end
          attrs
        end

        def parse_date(value)
          Tonight::Payload.parse_date(value)
        rescue ArgumentError
          raise InvalidDateParam
        end

        def render_invalid_date
          render json: { errors: [ "Date must be a valid ISO 8601 date" ] }, status: :unprocessable_entity
        end
      end
    end
  end
end
