class PermissionGrant < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :granted_by, class_name: "User", optional: true

  scope :active, -> { where(revoked_at: nil) }
  scope :pending_for_email, ->(email) { active.where(user_id: nil, email: email.to_s.strip.downcase) }

  normalizes :email, with: ->(email) { email.strip.downcase }
  before_validation :include_implied_view_action

  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :scope_type, inclusion: { in: Access::Capabilities::SCOPES }
  validates :capability, inclusion: { in: Access::Capabilities::ACTIONS.keys }
  validate :validate_permissions

  def self.accept_pending_for!(user, verified_email:)
    pending_for_email(verified_email).update_all(user_id: user.id, accepted_at: Time.current, updated_at: Time.current)
  end

  def api_json
    {
      id: id.to_s, email: email, scopeType: scope_type, scopeId: scope_id&.to_s,
      capability: capability, actions: actions, presetKey: preset_key,
      acceptedAt: accepted_at&.iso8601
    }
  end

  private

  def include_implied_view_action
    return unless actions.is_a?(Array) && actions.any?

    allowed = Access::Capabilities::ACTIONS.fetch(capability, [])
    self.actions = (actions | [ "view" ]) if allowed.include?("view") && (actions - allowed).empty?
  end

  def validate_permissions
    allowed = Access::Capabilities::ACTIONS.fetch(capability, [])
    if !actions.is_a?(Array) || actions.empty? || (actions - allowed).any?
      errors.add(:actions, "must contain permitted actions for the capability")
    end
    if capability == "view_audit_log" && (scope_type == "site" || actions.is_a?(Array) && actions.include?("export"))
      errors.add(:actions, "must be scoped viewing for audit access")
    end

    valid_scope = case scope_type
    when "site" then scope_id.nil?
    when "tournament" then Tournament.exists?(id: scope_id)
    when "campaign" then HostCampaign.exists?(id: scope_id)
    end
    errors.add(:scope_id, "must match an existing scope") unless valid_scope
  end
end
