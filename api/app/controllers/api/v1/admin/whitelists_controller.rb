module Api
  module V1
    module Admin
      class WhitelistsController < BaseController
        before_action :require_admin!

        def index
          entries = AdminWhitelist.order(active: :desc, email: :asc)
          render json: { whitelists: entries.map { |entry| serialize_whitelist(entry) } }
        end

        def create
          entry = AdminWhitelist.new(whitelist_params)
          if entry.save
            render json: { whitelist: serialize_whitelist(entry) }, status: :created
          else
            render_errors(entry)
          end
        end

        def update
          entry = AdminWhitelist.find(params[:id])
          if entry.update(whitelist_params)
            render json: { whitelist: serialize_whitelist(entry) }
          else
            render_errors(entry)
          end
        end

        private

        def whitelist_params
          raw = params.fetch(:whitelist, params)
          permitted = raw.permit(:email, :active, :notes)
          attrs = {}
          assign_param(attrs, permitted, :email, :email)
          if raw.key?(:role)
            attrs[:role] = AdminWhitelist::ROLES.find { |r| r == raw[:role].to_s } || raw[:role].to_s
          end
          assign_param(attrs, permitted, :active, :active)
          assign_param(attrs, permitted, :notes, :notes)
          attrs
        end

        def serialize_whitelist(entry)
          {
            id: entry.id.to_s,
            email: entry.email,
            role: entry.role,
            active: entry.active,
            notes: entry.notes,
            createdAt: entry.created_at&.iso8601,
            updatedAt: entry.updated_at&.iso8601
          }
        end
      end
    end
  end
end
