module Api
  module V1
    module Admin
      class ClassCohortsController < BaseController
        def index
          return render_forbidden unless access_policy.scope_ids("tournament", capability: "schedule_and_teams", action: "view").any?
          cohorts = ClassCohort.ordered
          render json: { classCohorts: cohorts.map(&:api_json) }
        end
      end
    end
  end
end
