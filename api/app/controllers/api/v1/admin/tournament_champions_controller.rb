module Api
  module V1
    module Admin
      class TournamentChampionsController < BaseController
        wrap_parameters false

        before_action :load_tournament
        before_action -> { authorize_tournament!("history_and_media", "view", @tournament.id) }, only: :index
        before_action -> { authorize_tournament!("history_and_media", "confirm_champions", @tournament.id) }, except: :index

        around_action :with_champion_audit, only: [ :create, :update, :destroy ]

        rescue_from ActiveRecord::RecordInvalid do |error|
          render_errors(error.record)
        end

        rescue_from ActiveRecord::RecordNotUnique do
          render json: { errors: [ "A champion record already exists for that bracket and edition." ] }, status: :unprocessable_entity
        end

        def index
          response.headers["Cache-Control"] = "no-store"
          render json: { champions: TournamentChampion.for_tournament(@tournament).includes(tournament_champion_credits: :class_cohort).ordered.map(&:api_json) }
        end

        def team_options
          render json: { teams: @tournament.teams.order(:display_name).distinct.pluck(:display_name) }
        end

        def create
          record = champions.new({ source: "admin_confirmed" }.merge(champion_params).merge(year: @tournament.year))
          record.slug = [ @tournament.year, @tournament.id, record.bracket.presence || "overall", record.edition_label.presence ].compact.join("-").parameterize
          record.save!
          render_record(record, key: :champion, status: :created)
        end

        def update
          record = champions.find(params[:id])
          record.assign_attributes(champion_params)
          record.champion_key = nil if record.will_save_change_to_champion_label?
          record.runner_up_key = nil if record.will_save_change_to_runner_up_label?
          record.save!
          render_record(record.reload, key: :champion)
        end

        def destroy
          champions.find(params[:id]).destroy!
          head :no_content
        end

        private

        def with_champion_audit(&action)
          TournamentChampion.with_connection do
            Audit::Context.with(actor: current_user, &action)
          end
        end

        def load_tournament
          @tournament = Tournament.find(params[:tournament_id])
        end

        def champions
          TournamentChampion.where(tournament_id: @tournament.id)
        end

        def champion_params
          raw = params.fetch(:champion) { request.request_parameters }
          raise ActionController::BadRequest, "Invalid champion payload" unless raw.is_a?(ActionController::Parameters) || raw.is_a?(Hash)

          raw = ActionController::Parameters.new(raw) if raw.is_a?(Hash)
          raw.permit(:bracket, :editionLabel, :edition_label, :championLabel, :champion_label,
            :runnerUpLabel, :runner_up_label, :score, :status, :primary, :notes, :position, :source)
            .to_h.transform_keys(&:underscore).symbolize_keys
        end
      end
    end
  end
end
