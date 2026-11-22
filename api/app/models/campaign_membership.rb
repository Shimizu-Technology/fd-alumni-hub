class CampaignMembership < ApplicationRecord
  ROLES = %w[chair treasurer board].freeze

  belongs_to :host_campaign
  belongs_to :user
  belongs_to :invited_by, class_name: "User", optional: true

  validates :role, presence: true, inclusion: { in: ROLES }
  validates :role, uniqueness: { scope: [ :host_campaign_id, :user_id ] }

  scope :active, -> { where(active: true) }

  def api_json
    {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      userId: user_id.to_s,
      userEmail: user&.email,
      userName: user&.full_name,
      role: role,
      active: active,
      invitedById: invited_by_id&.to_s,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
