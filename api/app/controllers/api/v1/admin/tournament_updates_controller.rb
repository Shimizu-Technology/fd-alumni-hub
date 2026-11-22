module Api
  module V1
    module Admin
      class TournamentUpdatesController < BaseController
        CAPABILITY = "tonights_menu_and_news"

        def index
          tournament = admin_tournament(CAPABILITY)
          return unless authorize_tournament!(CAPABILITY, "view", tournament&.id)

          render json: { updates: tournament.tournament_updates.ordered.map(&:api_json) }
        end

        def create
          tournament = admin_tournament(CAPABILITY)
          return unless authorize_tournament!(CAPABILITY, "view", tournament&.id)

          persist(tournament.tournament_updates.build(author: current_user))
        end

        def update
          persist(TournamentUpdate.find(params[:id]))
        end

        def destroy
          update = TournamentUpdate.find(params[:id])
          update.with_lock do
            next unless authorize_tournament!(CAPABILITY, write_action(update), update.tournament_id)

            update.destroy!
            head :no_content
          end
        end

        private

        def persist(record)
          attrs = update_params
          created = record.new_record?
          save = lambda do
            next unless authorize_tournament!(CAPABILITY, write_action(record, attrs[:status]), record.tournament_id)

            if record.update(attrs)
              render_record(record, key: :update, status: created ? :created : :ok)
            else
              render_errors(record)
            end
          end
          created ? save.call : record.with_lock(&save)
        rescue ArgumentError
          render json: { errors: [ "Target date must be a valid YYYY-MM-DD date" ] }, status: :unprocessable_entity
        end

        def write_action(record, status = nil)
          record.status == "published" || status == "published" ? "publish" : "edit"
        end

        def update_params
          raw = params.fetch(:update, params)
          permitted = raw.permit(:title, :body, :status, :pinned, :targetDate, :expiresAt)
          attrs = permitted.slice(:title, :body, :status, :pinned).to_h.symbolize_keys
          if permitted.key?(:targetDate)
            target = permitted[:targetDate].presence
            attrs[:target_date] = target && Tonight::Payload.parse_date(target)
          end
          assign_param(attrs, permitted, :expires_at, :expiresAt)
          attrs
        end
      end
    end
  end
end
