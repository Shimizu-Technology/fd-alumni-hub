class User < ApplicationRecord
  ROLES = %w[admin staff scorekeeper viewer].freeze

  has_many :campaign_memberships, dependent: :restrict_with_error

  before_validation :normalize_email

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :clerk_id, uniqueness: true, allow_blank: true
  validates :role, inclusion: { in: ROLES }

  scope :active, -> { where(active: true) }

  def admin?
    role == "admin"
  end

  def staff?
    admin? || role == "staff"
  end

  def scorekeeper?
    role == "scorekeeper"
  end

  def can_score_games?
    staff? || scorekeeper?
  end

  def viewer?
    role == "viewer"
  end

  def is_admin
    admin?
  end

  def is_staff
    staff?
  end

  def is_scorekeeper
    scorekeeper?
  end

  def full_name
    [ first_name, last_name ].compact_blank.join(" ").presence || email.split("@").first
  end

  def campaign_roles_for(campaign)
    return [] unless campaign

    campaign_memberships.active.where(host_campaign_id: campaign.id).pluck(:role)
  end

  def campaign_memberships_json
    memberships = campaign_memberships.active.includes(:host_campaign).order(:host_campaign_id, :role).to_a
    memberships.group_by(&:host_campaign).map do |campaign, rows|
      next unless campaign

      {
        campaignId: campaign.id.to_s,
        campaignSlug: campaign.slug,
        campaignTitle: campaign.title,
        status: campaign.status,
        roles: rows.map(&:role).uniq
      }
    end.compact
  end

  def api_json(include_campaign_memberships: false)
    payload = {
      id: id.to_s,
      clerkId: clerk_id,
      email: email,
      firstName: first_name,
      lastName: last_name,
      fullName: full_name,
      role: role,
      active: active,
      isAdmin: is_admin,
      isStaff: is_staff,
      isScorekeeper: is_scorekeeper,
      canScoreGames: can_score_games?,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
    payload[:campaignMemberships] = campaign_memberships_json if include_campaign_memberships
    payload
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase if email.present?
  end
end
