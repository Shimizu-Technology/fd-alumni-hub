class AdminWhitelist < ApplicationRecord
  ROLES = %w[admin staff viewer].freeze

  before_validation :normalize_email

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :role, inclusion: { in: ROLES }

  scope :active, -> { where(active: true) }

  def self.active_for_email(email)
    return nil if email.blank?

    active.find_by("LOWER(email) = ?", email.downcase)
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase if email.present?
  end
end
