module Standings
  class Ranker
    # Ranks eligible teams within each division using:
    # 1. Win percentage (with 0-0 ranked below any team with wins and above 0-N winless teams)
    # 2. Wins DESC, Losses ASC
    # 3. Two-team head-to-head pool record (when tied group has exactly 2 teams)
    # 4. Point differential DESC (if this splits a 3+-way tie down to a remaining 2-team tie, re-apply H2H once)
    # 5. Points for DESC
    # 6. Team display name ASC, Team ID ASC
    def self.rank_by_division(eligible_teams:, rows_by_team_id:, counted_games:)
      new(eligible_teams: eligible_teams, rows_by_team_id: rows_by_team_id, counted_games: counted_games).call
    end

    def initialize(eligible_teams:, rows_by_team_id:, counted_games:)
      @eligible_teams = eligible_teams
      @rows_by_team_id = rows_by_team_id
      @counted_games = counted_games
    end

    def call
      ranks = {}
      teams_by_division = @eligible_teams.group_by(&:division_id)

      teams_by_division.each_value do |division_teams|
        ordered = sort_division_teams(division_teams)
        ordered.each_with_index do |team, index|
          ranks[team.id] = index + 1
        end
      end

      ranks
    end

    private

    def sort_division_teams(teams)
      # Primary grouping by win percentage + wins + losses
      groups = teams.group_by { |team| primary_record_key(team) }
      sorted_keys = groups.keys.sort

      sorted_keys.flat_map do |key|
        tied = groups[key]
        resolve_tie_group(tied, allow_h2h: true)
      end
    end

    def primary_record_key(team)
      row = @rows_by_team_id.fetch(team.id)
      wins = row[:wins]
      losses = row[:losses]
      played = wins + losses
      # Tier: teams with wins (0), unplayed 0-0 teams (1), winless teams with losses (2)
      tier = if wins.positive?
        0
      elsif played.zero?
        1
      else
        2
      end
      win_pct = played.positive? ? (wins.to_f / played) : 0.0
      [ tier, -win_pct, -wins, losses ]
    end

    def resolve_tie_group(tied, allow_h2h:)
      return tied if tied.length <= 1

      if allow_h2h && tied.length == 2
        h2h = head_to_head_winner_order(tied[0], tied[1])
        return h2h if h2h
      end

      # Split by point differential DESC
      by_diff = tied.group_by do |team|
        row = @rows_by_team_id.fetch(team.id)
        -(row[:points_for] - row[:points_against])
      end

      by_diff.keys.sort.flat_map do |diff_key|
        sub = by_diff[diff_key]
        if sub.length == 1
          sub
        elsif allow_h2h && sub.length == 2 && tied.length > 2
          # Re-apply H2H once when point differential splits a 3+-way tie down to a remaining pair
          h2h = head_to_head_winner_order(sub[0], sub[1])
          h2h || fallback_sort(sub)
        else
          fallback_sort(sub)
        end
      end
    end

    def head_to_head_winner_order(team_a, team_b)
      a_wins = 0
      b_wins = 0

      @counted_games.each do |game|
        if game.home_team_id == team_a.id && game.away_team_id == team_b.id
          a_wins += 1 if game.home_score > game.away_score
          b_wins += 1 if game.away_score > game.home_score
        elsif game.home_team_id == team_b.id && game.away_team_id == team_a.id
          b_wins += 1 if game.home_score > game.away_score
          a_wins += 1 if game.away_score > game.home_score
        end
      end

      return nil if a_wins == b_wins

      a_wins > b_wins ? [ team_a, team_b ] : [ team_b, team_a ]
    end

    def fallback_sort(teams)
      teams.sort_by do |team|
        row = @rows_by_team_id.fetch(team.id)
        [ -row[:points_for], team.display_name.to_s.downcase, team.id ]
      end
    end
  end
end
