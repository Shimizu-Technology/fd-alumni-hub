class HafapassEventSnapshot < ApplicationRecord
  before_validation :normalize_slug

  validates :organizer_slug, presence: true, uniqueness: true, format: { with: HostCampaign::HAFAPASS_CODE_FORMAT }

  def fresh?(ttl_seconds)
    fetched_at.present? && fetched_at >= ttl_seconds.to_i.seconds.ago
  end

  def has_data?
    fetched_at.present? && payload_json.is_a?(Array)
  end

  def in_error_backoff?(backoff_seconds)
    seconds = backoff_seconds.to_i
    seconds.positive? && last_error_at.present? && last_error_at >= seconds.seconds.ago
  end

  def acquire_refresh_lease!(lease_seconds: 60)
    now = Time.current
    updated = self.class.where(id: id)
      .where("refreshing_until IS NULL OR refreshing_until < ?", now)
      .update_all(refreshing_until: now + lease_seconds.seconds, updated_at: now)
    updated == 1
  end

  private

  def normalize_slug
    self.organizer_slug = organizer_slug.to_s.strip.downcase if organizer_slug.present?
  end
end
