module Api
  module V1
    class UsersController < BaseController
      before_action :authenticate_user!

      def me
        render json: { user: current_user.api_json }
      end
    end
  end
end
