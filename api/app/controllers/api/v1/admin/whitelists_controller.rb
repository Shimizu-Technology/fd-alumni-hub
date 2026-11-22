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
          AdminWhitelist.transaction do
            unless entry.save
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            sync_matching_user!(entry)
            log_whitelist_change!("create", entry)
          end
          return if performed?

          render json: { whitelist: serialize_whitelist(entry) }, status: :created
        end

        def update
          entry = AdminWhitelist.find(params[:id])
          incoming = whitelist_params

          if entry.email == current_user.email && (incoming[:active] == false || (incoming[:role].present? && incoming[:role] != "admin"))
            return render json: { error: "Cannot deactivate or demote your own admin account" }, status: :unprocessable_entity
          end

          AdminWhitelist.transaction do
            unless entry.update(incoming)
              render_errors(entry)
              raise ActiveRecord::Rollback
            end

            sync_matching_user!(entry)
            log_whitelist_change!("update", entry)
          end
          return if performed?

          render json: { whitelist: serialize_whitelist(entry) }
        end

        private

        def sync_matching_user!(entry)
          user = User.find_by("LOWER(email) = ?", entry.email.downcase)
          return unless user
          return if user.id == current_user.id

          updates = {}
          updates[:role] = entry.role if entry.active? && user.role != entry.role
          updates[:active] = entry.active? if user.active? != entry.active?
          user.update!(updates) if updates.any?
        end

        def log_whitelist_change!(action, entry)
          Rails.logger.info(
            "AdminWhitelist #{action} by user_id=#{current_user.id} email=#{entry.email} role=#{entry.role} active=#{entry.active} ip=#{request.remote_ip}"
          )
        end

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
