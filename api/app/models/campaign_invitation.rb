class CampaignInvitation < ApplicationRecord
  ROLES = CampaignMembership::ROLES

  belongs_to :host_campaign
  belongs_to :invited_by, class_name: "User"
  belongs_to :accepted_by_user, class_name: "User", optional: true

  before_validation :normalize_email

  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, presence: true, inclusion: { in: ROLES }
  validate :unique_pending_invitation, on: :create

  scope :pending, -> { where(accepted_at: nil, revoked_at: nil) }
  scope :pending_for_email, ->(email) { pending.where("LOWER(email) = ?", email.to_s.strip.downcase) }
  scope :recent_first, -> { order(created_at: :desc, id: :desc) }

  def pending?
    accepted_at.nil? && revoked_at.nil?
  end

  def status
    return "accepted" if accepted_at.present?
    return "revoked" if revoked_at.present?

    "pending"
  end

  def self.accept_pending_for!(user, verified_email:, ip_address: nil)
    return [] if user.blank? || !user.active? || verified_email.blank?

    normalized = verified_email.to_s.strip.downcase
    accepted = []

    pending_for_email(normalized).includes(:host_campaign).find_each do |invitation|
      invitation.with_lock do
        next unless invitation.pending?

        membership = CampaignMembership.find_or_initialize_by(
          host_campaign: invitation.host_campaign,
          user: user,
          role: invitation.role
        )
        membership.active = true
        membership.invited_by ||= invitation.invited_by
        membership.save!

        invitation.update!(accepted_at: Time.current, accepted_by_user: user)

        FinanceAuditEvent.record!(
          campaign: invitation.host_campaign,
          actor: user,
          record: membership,
          action: "accept_invitation",
          changes: { "invitation_id" => invitation.id, "role" => invitation.role, "email" => normalized },
          ip_address: ip_address
        )

        accepted << membership
      end
    rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid => e
      Rails.logger.warn("Skipped campaign invitation #{invitation.id} during auto-accept: #{e.message}")
      next
    end

    accepted
  end

  def api_json
    {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      email: email,
      role: role,
      status: status,
      invitedById: invited_by_id.to_s,
      invitedByName: invited_by&.full_name,
      acceptedAt: accepted_at&.iso8601,
      acceptedByUserId: accepted_by_user_id&.to_s,
      revokedAt: revoked_at&.iso8601,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase if email.present?
  end

  def unique_pending_invitation
    return if host_campaign_id.blank? || email.blank? || role.blank?
    return unless self.class.pending.where(host_campaign_id: host_campaign_id, role: role).where("LOWER(email) = ?", email.downcase).exists?

    errors.add(:email, "already has a pending invitation for this campaign role")
  end
end
