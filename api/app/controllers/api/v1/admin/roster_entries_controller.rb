module Api
  module V1
    module Admin
      class RosterEntriesController < BaseController
        def create
          roster_entry = RosterEntry.new(roster_entry_params)

          if roster_entry.save
            render json: { rosterEntry: roster_entry.api_json }, status: :created
          else
            render_errors(roster_entry)
          end
        end

        def update
          roster_entry = RosterEntry.find(params[:id])

          if roster_entry.update(roster_entry_params.except(:team_id))
            render json: { rosterEntry: roster_entry.api_json }
          else
            render_errors(roster_entry)
          end
        end

        def destroy
          RosterEntry.find(params[:id]).destroy!
          head :no_content
        end

        private

        def roster_entry_params
          raw = params.fetch(:rosterEntry, params.fetch(:roster_entry, params))
          permitted = raw.permit(:team_id, :teamId, :name, :jersey_number, :jerseyNumber, :position, :nickname, :sort_order, :sortOrder, :active)

          attrs = {}
          assign_param(attrs, permitted, :team_id, :team_id, :teamId)
          assign_param(attrs, permitted, :name, :name)
          assign_param(attrs, permitted, :jersey_number, :jersey_number, :jerseyNumber)
          assign_param(attrs, permitted, :position, :position)
          assign_param(attrs, permitted, :nickname, :nickname)
          assign_param(attrs, permitted, :sort_order, :sort_order, :sortOrder)
          assign_param(attrs, permitted, :active, :active)
          attrs
        end
      end
    end
  end
end
