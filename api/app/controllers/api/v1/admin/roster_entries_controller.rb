module Api
  module V1
    module Admin
      class RosterEntriesController < BaseController
        def create
          attrs = roster_entry_params
          team = admin_tournament.teams.find(attrs.delete(:team_id))
          roster_entry = team.roster_entries.build(attrs)

          if roster_entry.save
            render json: { rosterEntry: roster_entry.api_json }, status: :created
          else
            render_errors(roster_entry)
          end
        end

        def bulk
          entries_payload = bulk_roster_entry_params
          return render json: { errors: [ "rosterEntries must be an array" ] }, status: :bad_request unless entries_payload

          created = []
          errors = []

          RosterEntry.transaction do
            entries_payload.each_with_index do |payload, index|
              attrs = roster_entry_attrs(payload)
              team_id = attrs.delete(:team_id)
              team = team_id.present? ? admin_tournament.teams.find_by(id: team_id) : nil

              if team.nil?
                errors << { index: index, errors: [ "Team not found" ] }
                next
              end

              roster_entry = team.roster_entries.build(attrs)
              if roster_entry.valid?
                created << roster_entry
              else
                errors << { index: index, errors: roster_entry.errors.full_messages }
              end
            end

            raise ActiveRecord::Rollback if errors.any?

            created.each(&:save!)
          end

          if errors.any?
            render json: { errors: errors }, status: :unprocessable_entity
          else
            render json: { created: created.length, rosterEntries: created.map(&:api_json) }, status: :created
          end
        end

        def update
          roster_entry = roster_entry_scope.find(params[:id])

          if roster_entry.update(roster_entry_params.except(:team_id))
            render json: { rosterEntry: roster_entry.api_json }
          else
            render_errors(roster_entry)
          end
        end

        def destroy
          roster_entry_scope.find(params[:id]).destroy!
          head :no_content
        end

        private

        def roster_entry_scope
          RosterEntry.joins(:team).where(teams: { tournament_id: admin_tournament.id })
        end

        def roster_entry_params
          raw = params.fetch(:rosterEntry, params.fetch(:roster_entry, params))
          roster_entry_attrs(permit_roster_entry(raw))
        end

        def bulk_roster_entry_params
          raw_entries = params[:rosterEntries] || params[:roster_entries]
          return unless raw_entries.is_a?(Array)

          raw_entries.map { |entry| permit_roster_entry(entry) }
        end

        def permit_roster_entry(raw_entry)
          raw_hash = raw_entry.respond_to?(:to_unsafe_h) ? raw_entry.to_unsafe_h : raw_entry
          raw_hash = {} unless raw_hash.is_a?(Hash)
          ActionController::Parameters.new(raw_hash).permit(:team_id, :teamId, :name, :jersey_number, :jerseyNumber, :position, :nickname, :sort_order, :sortOrder, :active)
        end

        def roster_entry_attrs(permitted)
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
