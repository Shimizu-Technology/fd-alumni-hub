require "securerandom"

class PendingReceiptUpload < ApplicationRecord
  EXPIRES_IN = 10.minutes

  belongs_to :host_campaign
  belongs_to :uploaded_by, class_name: "User"

  before_validation :assign_defaults, on: :create

  validates :upload_token, presence: true, uniqueness: true
  validates :s3_key, presence: true, uniqueness: true
  validates :original_filename, presence: true, length: { maximum: 180 }
  validates :expected_content_type, presence: true, inclusion: { in: PrivateReceiptStorage::ALLOWED_CONTENT_TYPES }
  validates :expires_at, presence: true

  scope :attachable, -> { where(attached_at: nil).where("expires_at > ?", Time.current) }

  def attachable?
    attached_at.nil? && expires_at.present? && expires_at > Time.current
  end

  private

  def assign_defaults
    self.upload_token ||= SecureRandom.hex(24)
    self.expires_at ||= EXPIRES_IN.from_now
  end
end
