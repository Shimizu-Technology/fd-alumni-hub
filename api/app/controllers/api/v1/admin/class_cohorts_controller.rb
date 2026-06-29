module Api
  module V1
    module Admin
      class ClassCohortsController < BaseController
        def index
          cohorts = ClassCohort.ordered
          render json: { classCohorts: cohorts.map(&:api_json) }
        end
      end
    end
  end
end
