module Api
  module V1
    class UsersController < BaseController
      before_action :authenticate_user!

      def me
        render json: { user: current_user.api_json(include_campaign_memberships: true).merge(Access::Policy.new(current_user).workspace) }
      end
    end
  end
end
