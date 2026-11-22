class FinanceAuditEvent < ApplicationRecord
  belongs_to :host_campaign
  belongs_to :actor, class_name: "User"

  validates :record_type, :record_id, :action, presence: true
  validates :created_at, presence: true

  before_validation :set_default_created_at, on: :create

  scope :recent_first, -> { order(created_at: :desc, id: :desc) }

  def readonly?
    persisted?
  end

  def self.record!(campaign:, actor:, record:, action:, changes: {}, reason: nil, ip_address: nil)
    create!(
      host_campaign: campaign,
      actor: actor,
      record_type: record.class.name,
      record_id: record.id,
      action: action.to_s,
      changes_json: changes || {},
      reason: reason.to_s.strip.presence,
      ip_address: ip_address.to_s.strip.presence,
      created_at: Time.current
    )
  end

  def api_json
    {
      id: id.to_s,
      hostCampaignId: host_campaign_id.to_s,
      actorId: actor_id.to_s,
      actorName: [ actor&.first_name, actor&.last_name ].compact_blank.join(" ").presence || actor&.email,
      recordType: record_type,
      recordId: record_id.to_s,
      action: action,
      changes: changes_json,
      reason: reason,
      createdAt: created_at&.iso8601
    }
  end

  private

  def set_default_created_at
    self.created_at ||= Time.current
  end
end
