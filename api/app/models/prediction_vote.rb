require "digest"

class PredictionVote < ApplicationRecord
  belongs_to :prediction_poll
  belongs_to :team

  validates :voter_token_hash, presence: true
  validates :voter_token_hash, uniqueness: { scope: :prediction_poll_id }
  validate :poll_is_open
  validate :team_is_valid_option

  def self.token_hash(token)
    Digest::SHA256.hexdigest(token.to_s)
  end

  private

  def poll_is_open
    return if prediction_poll&.open_for_voting?

    errors.add(:prediction_poll, "is closed")
  end

  def team_is_valid_option
    return if prediction_poll.blank? || team.blank?
    return if prediction_poll.option_teams.map(&:id).include?(team_id)

    errors.add(:team, "is not an option for this prediction")
  end
end
