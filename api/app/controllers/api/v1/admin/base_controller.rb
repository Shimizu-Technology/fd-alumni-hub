module Api
  module V1
    module Admin
      class BaseController < Api::V1::BaseController
        before_action :authenticate_user!

        private

        def access_policy
          @access_policy ||= Access::Policy.new(current_user)
        end

        def authorize!(capability, action, type: "site", id: nil)
          return true if access_policy.allows?(capability, action, scope_type: type, scope_id: id)

          render_forbidden("This action is outside your workspace access.")
          false
        end

        def authorize_tournament!(capability, action, id)
          authorize!(capability, action, type: "tournament", id: id)
        end

        def authorize_record_season!(capability, action, tournament_id, selected_tournament)
          return false unless authorize_tournament!(capability, action, tournament_id)
          return true if selected_tournament&.id == tournament_id

          raise ActiveRecord::RecordNotFound, "Record does not belong to the selected tournament"
        end

        def authorize_collection_scope(records, capability)
          id = params[:tournamentId].presence || params[:tournament_id].presence
          return records.where(tournament_id: id) if id && authorize_tournament!(capability, "view", id)
          return records.none if performed?
          return records if access_policy.allows?(capability, "view")

          ids = access_policy.scope_ids("tournament", capability: capability, action: "view")
          render_forbidden if ids.empty?
          records.where(tournament_id: ids)
        end

        def workspace_tournaments
          Tournament.where(id: access_policy.scope_ids("tournament"))
        end

        def render_record(record, key:, status: :ok)
          render json: { key => record.api_json }, status: status
        end

        def render_errors(record)
          render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
        end

        def admin_tournament(capability = nil)
          @admin_tournaments ||= {}
          @admin_tournaments[capability] ||= begin
            if params[:tournamentId].present?
              Tournament.find(params[:tournamentId])
            elsif params[:tournament_id].present?
              Tournament.find(params[:tournament_id])
            elsif params[:year].present?
              Tournament.find_by!(year: params[:year].to_i)
            else
              scope = if capability
                Tournament.where(id: access_policy.scope_ids("tournament", capability: capability))
              else
                workspace_tournaments
              end
              scope.find_by(id: Tournament.active_for_public&.id) || scope.order(year: :desc, start_date: :desc).first
            end
          end
        end

        def assign_param(attrs, permitted, target_key, *source_keys)
          source_keys.each do |source_key|
            next unless permitted.key?(source_key)

            attrs[target_key] = permitted[source_key]
            return
          end
        end
      end
    end
  end
end
