class PredictionPoll < ApplicationRecord
  POLL_TYPES = %w[game tournament].freeze
  STATUSES = %w[open closed].freeze

  belongs_to :tournament
  belongs_to :game, optional: true
  has_many :prediction_votes, dependent: :destroy

  validates :poll_type, inclusion: { in: POLL_TYPES }
  validates :status, inclusion: { in: STATUSES }
  validates :question, presence: true
  validate :game_poll_has_game
  validate :game_belongs_to_tournament
  validate :single_tournament_poll

  scope :ordered, -> { order(:poll_type, :game_id, :id) }
  scope :open_for_voting, -> { where(status: "open").where("closes_at IS NULL OR closes_at > ?", Time.current) }

  def open_for_voting?
    status == "open" && (closes_at.blank? || closes_at.future?)
  end

  def option_teams
    @option_teams ||= begin
      if poll_type == "game" && game
        [ game.away_team, game.home_team ].compact
      elsif tournament.association(:teams).loaded?
        tournament.teams.sort_by { |team| [ team.division.to_s, team.display_name.to_s, team.id || 0 ] }
      else
        tournament.teams.includes(:division_record).order(:division, :display_name, :id)
      end
    end
  end

  def api_json(voter_token_hash: nil)
    preloaded_votes = preloaded_prediction_votes
    selected_team_id = selected_team_id_for(voter_token_hash, preloaded_votes)
    totals_by_team = prediction_vote_totals(preloaded_votes)
    total_votes = totals_by_team.values.sum

    {
      id: id.to_s,
      tournamentId: tournament_id.to_s,
      gameId: game_id&.to_s,
      pollType: poll_type,
      question: question,
      status: status,
      open: open_for_voting?,
      closesAt: closes_at&.iso8601,
      totalVotes: total_votes,
      selectedTeamId: selected_team_id&.to_s,
      game: game&.summary_json,
      options: option_teams.map { |team| option_json(team, totals_by_team, total_votes, selected_team_id) },
      createdAt: created_at&.iso8601,
      updatedAt: updated_at&.iso8601
    }
  end

  private

  def preloaded_prediction_votes
    prediction_votes.to_a if association(:prediction_votes).loaded?
  end

  def selected_team_id_for(voter_token_hash, preloaded_votes)
    return nil if voter_token_hash.blank?

    if preloaded_votes
      preloaded_votes.find { |vote| vote.voter_token_hash == voter_token_hash }&.team_id
    else
      prediction_votes.find_by(voter_token_hash: voter_token_hash)&.team_id
    end
  end

  def prediction_vote_totals(preloaded_votes)
    return prediction_votes.group(:team_id).count unless preloaded_votes

    preloaded_votes.each_with_object(Hash.new(0)) do |vote, totals|
      totals[vote.team_id] += 1
    end
  end

  def option_json(team, totals_by_team, total_votes, selected_team_id)
    votes = totals_by_team[team.id] || 0
    {
      teamId: team.id.to_s,
      displayName: team.display_name,
      classYearLabel: team.class_year_label,
      division: team.resolved_division,
      selected: selected_team_id == team.id,
      votes: votes,
      percent: total_votes.positive? ? ((votes.to_f / total_votes) * 100).round : nil
    }
  end

  def game_poll_has_game
    errors.add(:game, "is required for game prediction polls") if poll_type == "game" && game.blank?
  end

  def game_belongs_to_tournament
    return if game.blank? || tournament_id.blank? || game.tournament_id == tournament_id

    errors.add(:game, "must belong to the selected tournament")
  end

  def single_tournament_poll
    return unless poll_type == "tournament" && tournament_id.present?

    existing_poll = PredictionPoll.where(tournament_id: tournament_id, poll_type: "tournament")
    existing_poll = existing_poll.where.not(id: id) if id.present?
    errors.add(:poll_type, "already has a tournament prediction poll") if existing_poll.exists?
  end
end
