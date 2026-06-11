class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound, with: :render_record_not_found

  private

  def render_record_not_found
    render json: { error: "Not found" }, status: :not_found
  end
end
