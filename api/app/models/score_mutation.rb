class ScoreMutation < ApplicationRecord
  belongs_to :actor, class_name: "User"
  belongs_to :game
end
