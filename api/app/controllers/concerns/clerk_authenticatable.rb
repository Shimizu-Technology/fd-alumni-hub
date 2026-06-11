module ClerkAuthenticatable
  extend ActiveSupport::Concern

  private

  def authenticate_user!
    header = request.headers["Authorization"]

    unless header.present?
      render_unauthorized("Missing authorization header")
      return
    end

    token = header.split.last
    decoded = ClerkAuth.verify(token)

    unless decoded
      render_unauthorized("Invalid or expired token")
      return
    end

    clerk_id = decoded["sub"]
    email = email_from_claims(decoded)
    email ||= ClerkAuth.fetch_user_email(clerk_id) if clerk_id.present?

    @current_user = find_or_create_user(
      clerk_id: clerk_id,
      email: email,
      first_name: decoded["first_name"] || decoded.dig("user", "first_name"),
      last_name: decoded["last_name"] || decoded.dig("user", "last_name")
    )

    unless @current_user
      render_unauthorized("User not allowed. Ask an organizer to add this email to the admin allowlist.")
    end
  end

  def authenticate_user_optional
    header = request.headers["Authorization"]
    return unless header.present?

    token = header.split.last
    decoded = ClerkAuth.verify(token)
    return unless decoded

    @current_user = User.active.find_by(clerk_id: decoded["sub"])
  end

  def current_user
    @current_user
  end

  def require_admin!
    authenticate_user! unless @current_user
    return if performed?

    render_forbidden("Admin access required") unless @current_user&.admin?
  end

  def require_staff!
    authenticate_user! unless @current_user
    return if performed?

    render_forbidden("Staff access required") unless @current_user&.staff?
  end

  def find_or_create_user(clerk_id:, email:, first_name:, last_name:)
    return nil if clerk_id.blank?

    user = User.active.find_by(clerk_id: clerk_id)
    if user
      return sync_existing_user(user, email, first_name, last_name)
    end

    if email.present?
      user = User.active.find_by("LOWER(email) = ?", email.downcase)
      if user
        return sync_existing_user(user, email, first_name, last_name, clerk_id: clerk_id)
      end

      whitelist = AdminWhitelist.active_for_email(email)
      if whitelist
        return create_whitelisted_user(
          clerk_id: clerk_id,
          email: email,
          first_name: first_name,
          last_name: last_name,
          role: whitelist.role
        )
      end
    end

    nil
  end

  def sync_existing_user(user, email, first_name, last_name, clerk_id: nil, role: nil)
    return nil unless user&.active?

    update_user_from_claims(user, email, first_name, last_name, clerk_id: clerk_id, role: role)
    user
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
    recover_synced_user(user, email, clerk_id)
  end

  def recover_synced_user(user, email, clerk_id)
    by_clerk_id = User.active.find_by(clerk_id: clerk_id) if clerk_id.present?
    return by_clerk_id if by_clerk_id

    reloaded_user = reload_user(user)
    return reloaded_user if reloaded_user&.active?

    return nil if email.blank?

    User.active.find_by("LOWER(email) = ?", email.downcase)
  end

  def reload_user(user)
    user&.reload
  rescue ActiveRecord::RecordNotFound
    nil
  end

  def create_whitelisted_user(clerk_id:, email:, first_name:, last_name:, role:)
    user = User.create_or_find_by!(clerk_id: clerk_id) do |record|
      record.email = email
      record.first_name = first_name
      record.last_name = last_name
      record.role = role
      record.active = true
    end

    sync_whitelisted_user(user, email, first_name, last_name, clerk_id: clerk_id, role: role)
  rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique, ActiveRecord::RecordNotFound
    user = User.find_by(clerk_id: clerk_id) || User.find_by("LOWER(email) = ?", email.downcase)
    sync_whitelisted_user(user, email, first_name, last_name, clerk_id: clerk_id, role: role)
  end

  def sync_whitelisted_user(user, email, first_name, last_name, clerk_id:, role:)
    sync_existing_user(user, email, first_name, last_name, clerk_id: clerk_id, role: role)
  end

  def update_user_from_claims(user, email, first_name, last_name, clerk_id: nil, role: nil)
    updates = {}
    updates[:clerk_id] = clerk_id if clerk_id.present? && user.clerk_id.blank?
    updates[:email] = email if email.present? && email.downcase != user.email
    updates[:first_name] = first_name if first_name.present?
    updates[:last_name] = last_name if last_name.present?
    updates[:role] = role if role.present? && user.role != role
    user.update!(updates) if updates.any?
  end

  def email_from_claims(decoded)
    direct = decoded["email"] || decoded["email_address"] || decoded["primary_email_address"]
    return direct if direct.present?

    nested = decoded.dig("user", "email") || decoded.dig("user", "email_address") || decoded.dig("user", "primary_email_address")
    return nested if nested.present?

    emails = decoded["email_addresses"] || decoded.dig("user", "email_addresses")
    return nil unless emails.is_a?(Array)

    primary_id = decoded["primary_email_address_id"] || decoded.dig("user", "primary_email_address_id")
    primary = emails.find { |address| address.is_a?(Hash) && address["id"] == primary_id }
    first = primary || emails.find { |address| address.is_a?(Hash) }
    first && (first["email_address"] || first["email"])
  end

  def render_unauthorized(message = "Unauthorized")
    render json: { error: message }, status: :unauthorized
  end

  def render_forbidden(message = "Forbidden")
    render json: { error: message }, status: :forbidden
  end
end
