module Api
  module V1
    module Admin
      class UserAccessController < BaseController
        before_action :require_admin!

        def update
          attrs = {}
          attrs[:super_admin] = params[:superAdmin] if params.key?(:superAdmin)
          attrs[:active] = params[:active] if params.key?(:active)
          if attrs.empty? || attrs.values.any? { |value| value != true && value != false }
            return render json: { error: "Specify an account access change." }, status: :unprocessable_entity
          end

          user = User.find(params[:id])
          user.with_lock do
            attrs[:role] = "viewer" if attrs[:super_admin] == false && user.role == "admin"
            user.update!(attrs)
          end
          render json: { user: user.api_json.merge(superAdmin: user.super_admin?) }
        rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotSaved
          render_errors(user)
        end
      end
    end
  end
end
