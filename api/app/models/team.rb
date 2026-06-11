class Team < ApplicationRecord
  belongs_to :tournament

  has_many :home_games, class_name: "Game", foreign_key: :home_team_id, dependent: :restrict_with_error, inverse_of: :home_team
  has_many :away_games, class_name: "Game", foreign_key: :away_team_id, dependent: :restrict_with_error, inverse_of: :away_team
  has_many :standings, dependent: :destroy

  validates :class_year_label, :display_name, presence: true
  validates :display_name, uniqueness: { scope: :tournament_id }

  def api_json
    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      classYearLabel: class_year_label,
      displayName: display_name,
      division: division,
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end
end
