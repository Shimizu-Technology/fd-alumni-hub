class ContentIngestItem < ApplicationRecord
  KINDS = %w[article media].freeze
  STATUSES = %w[pending approved rejected].freeze

  belongs_to :tournament

  validates :kind, inclusion: { in: KINDS }
  validates :status, inclusion: { in: STATUSES }
  validates :source, :title, :url, presence: true
  validates :url, uniqueness: { scope: :tournament_id }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      kind: kind,
      status: status,
      source: source,
      title: title,
      url: url,
      imageUrl: image_url,
      excerpt: excerpt,
      confidence: confidence,
      notes: notes,
      importedToId: imported_to_id,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
