module Api
  module V1
    module Admin
      class TeamsController < BaseController
        def index
          teams = Team.includes(:tournament, :division_record, :roster_entries, team_class_memberships: :class_cohort).order(:tournament_id, :division, :display_name)
          teams = teams.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?

          render json: { teams: teams.map { |team| team.api_json(include_roster: true) } }
        end

        def create
          attrs = team_params
          class_cohort_keys = attrs.delete(:class_cohort_keys)
          team = admin_tournament.teams.build(attrs.except(:tournament_id))

          Team.transaction do
            unless team.save
              render_errors(team)
              raise ActiveRecord::Rollback
            end

            sync_manual_memberships(team, class_cohort_keys) if class_cohort_keys.present?
          end
          return if performed?

          render json: { team: team_for_response(team.id).api_json(include_roster: true) }, status: :created
        rescue ClassArchive::SyncManualTeamMemberships::ConflictError => error
          team.errors.add(:base, error.message)
          render_errors(team)
        end

        def update
          team = admin_tournament.teams.find(params[:id])

          attrs = team_params
          class_cohort_keys = attrs.delete(:class_cohort_keys)
          class_cohort_keys_changed = attrs.delete(:class_cohort_keys_changed)

          Team.transaction do
            unless team.update(attrs.except(:tournament_id))
              render_errors(team)
              raise ActiveRecord::Rollback
            end

            sync_manual_memberships(team, class_cohort_keys) if manual_class_cohort_update?(class_cohort_keys, class_cohort_keys_changed)
          end
          return if performed?

          render json: { team: team_for_response(team.id).api_json(include_roster: true) }
        rescue ClassArchive::SyncManualTeamMemberships::ConflictError => error
          team.errors.add(:base, error.message)
          render_errors(team)
        end

        def destroy
          team = admin_tournament.teams.find(params[:id])

          if team.destroy
            head :no_content
          else
            render_errors(team)
          end
        end

        private

        def team_for_response(id)
          Team.includes(:tournament, :division_record, :roster_entries, team_class_memberships: :class_cohort).find(id)
        end

        def sync_manual_memberships(team, class_cohort_keys)
          ClassArchive::SyncManualTeamMemberships.call(team, class_keys: class_cohort_keys)
        end

        def manual_class_cohort_update?(class_cohort_keys, changed_flag)
          !class_cohort_keys.nil? && ActiveModel::Type::Boolean.new.cast(changed_flag)
        end

        def team_params
          raw = params.fetch(:team, params)
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :class_year_label,
            :classYearLabel,
            :display_name,
            :displayName,
            :division_id,
            :divisionId,
            :division,
            :class_cohort_keys_changed,
            :classCohortKeysChanged,
            class_cohort_keys: [],
            classCohortKeys: []
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :class_year_label, :class_year_label, :classYearLabel)
          assign_param(attrs, permitted, :display_name, :display_name, :displayName)
          assign_param(attrs, permitted, :division_id, :division_id, :divisionId)
          assign_param(attrs, permitted, :division, :division)
          assign_param(attrs, permitted, :class_cohort_keys, :class_cohort_keys, :classCohortKeys)
          assign_param(attrs, permitted, :class_cohort_keys_changed, :class_cohort_keys_changed, :classCohortKeysChanged)
          attrs
        end
      end
    end
  end
end
