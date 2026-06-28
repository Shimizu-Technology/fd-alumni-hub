require "json"

module DataImport
  class Fd2026ScheduleImport
    DEFAULT_PATH = Rails.root.join("..", "data", "schedules", "fd-2026-pool-play-2026-06-27.json").expand_path.freeze
    SOURCE_NOTE = "source=fd-2026-pool-play-2026-06-27".freeze
    CANONICAL_TEAM_LABELS = {
      "435" => "430-5",
      "815" => "08/15",
      "8/15" => "08/15"
    }.freeze

    def self.call(path: nil, overwrite: false)
      new(path: path, overwrite: overwrite).call
    end

    def initialize(path: nil, overwrite: false)
      @path = Pathname(path.presence || DEFAULT_PATH)
      @overwrite = overwrite
    end

    def call
      payload = JSON.parse(path.read)
      games = payload.fetch("games")
      source = payload.fetch("source")

      ActiveRecord::Base.transaction do
        tournament = upsert_tournament(payload.fetch("tournament"))
        teams = upsert_teams(tournament, games)
        import_games(tournament, teams, games, source)
        Standings::Recompute.call(tournament)

        {
          tournamentId: tournament.id.to_s,
          tournamentYear: tournament.year,
          teams: teams.length,
          games: games.length,
          skippedRows: payload.fetch("skippedRows", []).length,
          overwrite: overwrite?,
          source: source.slice("title", "scheduleAsOf", "sourceFile")
        }
      end
    end

    private

    attr_reader :path

    def overwrite?
      @overwrite == true
    end

    def upsert_tournament(attrs)
      tournament = Tournament.find_by(year: attrs.fetch("year")) || Tournament.new(year: attrs.fetch("year"))
      tournament.name = attrs.fetch("name") if tournament.name.blank?
      tournament.legacy_id ||= "fd-#{attrs.fetch("year")}-tournament"
      source_start_date = Date.iso8601(attrs.fetch("startDate"))
      source_end_date = Date.iso8601(attrs.fetch("endDate"))
      tournament.start_date = source_start_date if tournament.new_record? || overwrite? || tournament.start_date.blank?
      tournament.end_date = source_end_date if tournament.new_record? || overwrite? || tournament.end_date.blank?
      tournament.status = attrs.fetch("status") if tournament.new_record?
      tournament.save!
      tournament
    end

    def upsert_teams(tournament, games)
      labels = games.flat_map { |game| [ game.fetch("awayTeam"), game.fetch("homeTeam") ] }.uniq

      labels.index_with { |label| upsert_team(tournament, label) }
    end

    def upsert_team(tournament, source_label)
      label = canonical_team_label(source_label)
      legacy_ids = team_legacy_ids(source_label, label)
      team = Team.where(legacy_id: legacy_ids).first || tournament.teams.find_by(display_name: [ label, *alias_labels_for(label) ]) || tournament.teams.build
      team.legacy_id = team_legacy_id(label) if team.legacy_id.blank? || legacy_ids.include?(team.legacy_id)
      team.class_year_label = label if should_assign_team_label?(team.class_year_label, label)
      team.display_name = label if should_assign_team_label?(team.display_name, label)
      team.save!
      team
    end

    def import_games(tournament, teams, games, source)
      games.each do |entry|
        away_team = teams.fetch(entry.fetch("awayTeam"))
        home_team = teams.fetch(entry.fetch("homeTeam"))
        start_time = guam_start_time(entry.fetch("date"), entry.fetch("time"))
        game = game_for_import(tournament, entry, away_team, home_team, start_time)

        game.legacy_id ||= game_legacy_id(entry.fetch("gameNumber"))
        game.status = "scheduled" if game.new_record?
        assign_schedule_fields(game, entry, away_team, home_team, start_time, source) if game.new_record? || overwrite?
        preserve_schedule_metadata(game, entry, source) unless game.new_record? || overwrite?
        game.save!
      end
    end

    def assign_schedule_fields(game, entry, away_team, home_team, start_time, source)
      game.away_team = away_team
      game.home_team = home_team
      game.start_time = start_time
      game.venue = source.fetch("venue", "The Jungle")
      game.bracket_code = entry.fetch("gameNumber")
      game.notes = imported_notes(game.notes, entry.fetch("phase"), source.fetch("scheduleAsOf"))
    end

    def preserve_schedule_metadata(game, entry, source)
      game.venue = source.fetch("venue", "The Jungle") if game.venue.blank?
      game.bracket_code = entry.fetch("gameNumber") if game.bracket_code.blank?
      game.notes = imported_notes(game.notes, entry.fetch("phase"), source.fetch("scheduleAsOf")) unless game.notes.to_s.include?("phase=")
    end

    def game_for_import(tournament, entry, away_team, home_team, start_time)
      legacy_id = game_legacy_id(entry.fetch("gameNumber"))
      Game.find_by(legacy_id: legacy_id) ||
        tournament.games.find_by(start_time: start_time, away_team: away_team, home_team: home_team) ||
        tournament.games.build(legacy_id: legacy_id)
    end

    def imported_notes(current_notes, phase, schedule_as_of)
      manual_notes = current_notes.to_s.split(";").map(&:strip).reject do |part|
        part.blank? || part.start_with?("phase=") || part == SOURCE_NOTE || part.start_with?("schedule_as_of=")
      end

      ([ "phase=#{phase}", SOURCE_NOTE, "schedule_as_of=#{schedule_as_of}" ] + manual_notes).join("; ")
    end

    def guam_start_time(date_value, time_value)
      date = Date.iso8601(date_value)
      match = time_value.match(/\A(\d{1,2}):(\d{2})(am|pm)\z/i)
      raise ArgumentError, "Invalid schedule time: #{time_value}" unless match

      hour = match[1].to_i
      minute = match[2].to_i
      meridiem = match[3].downcase
      hour = 0 if meridiem == "am" && hour == 12
      hour += 12 if meridiem == "pm" && hour < 12

      Time.find_zone!("Pacific/Guam").local(date.year, date.month, date.day, hour, minute, 0)
    end

    def should_assign_team_label?(current_value, label)
      overwrite? || current_value.blank? || canonical_team_label(current_value) == label
    end

    def canonical_team_label(label)
      normalized_label = label.to_s.strip.downcase
      CANONICAL_TEAM_LABELS.fetch(normalized_label, label.to_s.strip)
    end

    def team_legacy_ids(source_label, label = canonical_team_label(source_label))
      ([ label, source_label ] + alias_labels_for(label)).map { |value| team_legacy_id(value) }.uniq
    end

    def alias_labels_for(label)
      canonical_label = canonical_team_label(label)
      CANONICAL_TEAM_LABELS.filter_map { |source, target| source if target == canonical_label }
    end

    def team_legacy_id(label)
      "fd-2026-team-#{stable_slug(label)}"
    end

    def game_legacy_id(game_number)
      "fd-2026-schedule-#{stable_slug(game_number)}"
    end

    def stable_slug(value)
      value.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|\-\z/, "")
    end
  end
end
