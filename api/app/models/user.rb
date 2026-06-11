class User < ApplicationRecord
  ROLES = %w[admin staff viewer].freeze

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

  def viewer?
    role == "viewer"
  end

  def is_admin
    admin?
  end

  def is_staff
    staff?
  end

  def full_name
    [ first_name, last_name ].compact_blank.join(" ").presence || email.split("@").first
  end

  def api_json
    {
      id: id.to_s,
      clerkId: clerk_id,
      email: email,
      firstName: first_name,
      lastName: last_name,
      fullName: full_name,
      role: role,
      active: active,
      is_admin: is_admin,
      is_staff: is_staff,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase if email.present?
  end
end
