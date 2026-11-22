require "csv"
require "date"

module Imports
  class ScheduleParser
    MAX_BYTES = 512_000
    MAX_ROWS = 400
    GUAM_ZONE = "Pacific/Guam".freeze

    class ParseError < StandardError; end

    Result = Struct.new(:detected_format, :rows, keyword_init: true)

    HEADER_ALIASES = {
      "date" => :date,
      "game_date" => :date,
      "gamedate" => :date,
      "day" => :date,
      "time" => :time,
      "tipoff" => :time,
      "start_time" => :time,
      "starttime" => :time,
      "home" => :home_team,
      "home_team" => :home_team,
      "hometeam" => :home_team,
      "away" => :away_team,
      "away_team" => :away_team,
      "awayteam" => :away_team,
      "division" => :division,
      "div" => :division,
      "phase" => :phase,
      "game_number" => :game_number,
      "gamenumber" => :game_number,
      "game" => :game_number,
      "game #" => :game_number,
      "game#" => :game_number,
      "gm" => :game_number,
      "venue" => :venue,
      "court" => :venue,
      "location" => :venue,
      "bracket_code" => :bracket_code,
      "bracketcode" => :bracket_code,
      "bracket" => :bracket_code,
      "bracket_round" => :bracket_round,
      "bracketround" => :bracket_round,
      "round" => :bracket_round,
      "bracket_slot" => :bracket_slot,
      "bracketslot" => :bracket_slot,
      "slot" => :bracket_slot,
      "notes" => :notes,
      "note" => :notes,
      "status" => :status,
      "home_score" => :home_score,
      "homescore" => :home_score,
      "away_score" => :away_score,
      "awayscore" => :away_score
    }.freeze

    PLAYOFF_CODE_REGEX = /\A(?:[WL]?(?:MP|GP|PP)|[MGP]?(?:QF|SF|F)|L)\d*\z/i

    def self.call(content:, format: "auto", default_venue: "The Jungle", fallback_year: nil)
      new(content: content, format: format, default_venue: default_venue, fallback_year: fallback_year).call
    end

    def initialize(content:, format: "auto", default_venue: "The Jungle", fallback_year: nil)
      @content = content.to_s
      @format = format.to_s.strip.downcase.presence || "auto"
      @default_venue = default_venue.to_s.strip.presence || "The Jungle"
      @fallback_year = fallback_year&.to_i || Date.current.year
    end

    def call
      raise ParseError, "Schedule content is required" if @content.strip.blank?
      raise ParseError, "Schedule content exceeds #{MAX_BYTES / 1024} KB limit" if @content.bytesize > MAX_BYTES

      detected = detect_format
      rows = case detected
      when "csv"
        parse_csv
      when "fdmsaa_text"
        parse_fdmsaa_text
      else
        raise ParseError, "Unsupported import format: #{@format}"
      end

      raise ParseError, "Import exceeds maximum of #{MAX_ROWS} rows (#{rows.length} found)" if rows.length > MAX_ROWS
      raise ParseError, "No schedule rows could be parsed from the input" if rows.empty?

      Result.new(detected_format: detected, rows: rows)
    end

    private

    def detect_format
      return @format if %w[csv fdmsaa_text].include?(@format)

      first_line = @content.lines.map(&:strip).find(&:present?).to_s
      if first_line.include?(",") && csv_header_line?(first_line)
        "csv"
      else
        "fdmsaa_text"
      end
    end

    def csv_header_line?(line)
      cells = CSV.parse_line(line) || []
      normalized = cells.map { |cell| canonical_header(cell) }.compact
      normalized.include?(:home_team) && normalized.include?(:away_team)
    rescue CSV::MalformedCSVError
      false
    end

    def parse_csv
      table = CSV.parse(@content.lstrip, headers: true, skip_blanks: true)
      mapped_headers = table.headers.each_with_object({}) do |raw_header, map|
        key = canonical_header(raw_header)
        map[raw_header] = key if key
      end

      unless mapped_headers.values.include?(:home_team) && mapped_headers.values.include?(:away_team)
        raise ParseError, "CSV must include awayTeam (or away) and homeTeam (or home) columns"
      end

      rows = []
      table.each_with_index do |csv_row, idx|
        fields = {}
        mapped_headers.each do |raw_header, key|
          value = csv_row[raw_header].to_s.strip
          fields[key] = value.presence
        end
        next if fields.values.all?(&:nil?)

        rows << build_parsed_row(fields, idx + 2)
      end
      rows
    rescue CSV::MalformedCSVError => e
      raise ParseError, "Invalid CSV syntax: #{e.message}"
    end

    def parse_fdmsaa_text
      rows = []
      current_date = nil

      @content.each_line.with_index(1) do |raw_line, line_no|
        line = raw_line.strip
        next if line.blank? || line.start_with?("#")

        parsed_header_date = parse_date_header(line)
        if parsed_header_date
          current_date = parsed_header_date
          next
        end

        row = parse_fdmsaa_game_line(line, line_no, current_date)
        rows << row if row
      end

      rows
    end

    def parse_date_header(line)
      # Skip lines that look like a game matchup ("vs" or "@")
      return nil if line.match?(/\b(?:vs\.?|versus|@)\b/i)

      cleaned = line.sub(/\A(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*,?\s+/i, "").strip
      parse_date_string(cleaned)
    end

    def parse_fdmsaa_game_line(line, line_no, current_date)
      # Support pipe-delimited, tab-delimited, or multi-space-delimited lines containing "<away> vs <home>"
      tokens = if line.include?("|")
        line.split("|").map(&:strip).reject(&:blank?)
      elsif line.include?("\t")
        line.split("\t").map(&:strip).reject(&:blank?)
      else
        line.split(/\s{2,}/).map(&:strip).reject(&:blank?)
      end

      # Fall back to regex extraction for single-spaced lines like "G1 6:00 PM 2016 vs 2017 Maroon"
      if tokens.length == 1
        return parse_single_spaced_line(line, line_no, current_date)
      end

      matchup_idx = tokens.index { |tok| tok.match?(/\b(?:vs\.?|versus)\b|\s@\s/i) }
      return nil unless matchup_idx

      away_team, home_team = split_matchup(tokens[matchup_idx])
      other_tokens = tokens.each_with_index.reject { |_, i| i == matchup_idx }.map(&:first)

      date_str = current_date&.iso8601
      time_str = nil
      game_number = nil
      division = nil
      phase = nil
      venue = nil

      other_tokens.each do |tok|
        if time_str.nil? && tok.match?(/\A\d{1,2}:\d{2}\s*(?:am|pm)?\z/i)
          time_str = tok
        elsif date_str.nil? && parse_date_string(tok)
          date_str = parse_date_string(tok).iso8601
        elsif tok.match?(/\A(?:pool|playoff|fatherson|father-son|exhibition)\z/i)
          phase = normalize_phase_token(tok)
        elsif game_number.nil? && tok.match?(/\A(?:G|GM|FS|MP|GP|PP|MQF|MSF|MF|GQF|GSF|GF|PQF|PSF|PF|QF|SF|F|L)[A-Z0-9-]*\d+\z/i)
          game_number = tok.upcase
        elsif division.nil?
          division = tok
        elsif venue.nil?
          venue = tok
        end
      end

      build_parsed_row(
        {
          date: date_str,
          time: time_str,
          away_team: away_team,
          home_team: home_team,
          game_number: game_number,
          bracket_code: game_number,
          division: division,
          phase: phase,
          venue: venue
        },
        line_no
      )
    end

    def parse_single_spaced_line(line, line_no, current_date)
      pattern = /\A(?:(?<game>[A-Z]{1,4}\d+[A-Z0-9-]*)\s+)?(?<time>\d{1,2}:\d{2}\s*(?:am|pm)?)\s+(?<away>.+?)\s+(?:vs\.?|versus|@)\s+(?<home>.+?)(?:\s+\[(?<div_bracket>[^\]]+)\])?\z/i
      m = line.match(pattern)
      return nil unless m

      home_raw = m[:home].strip
      division = m[:div_bracket]&.strip
      phase = nil

      # Optional trailing division keyword like "... 2017 Maroon" or "... 2017 Gold Playoff"
      if division.nil?
        trailing = home_raw.match(/\A(.+?)\s+(Maroon|Gold|Platinum|Special|Diamond)(?:\s+(Pool|Playoff|Father-Son|Exhibition))?\z/i)
        if trailing
          home_raw = trailing[1].strip
          division = trailing[2].strip
          phase = normalize_phase_token(trailing[3]) if trailing[3]
        end
      end

      build_parsed_row(
        {
          date: current_date&.iso8601,
          time: m[:time]&.strip,
          away_team: m[:away]&.strip,
          home_team: home_raw,
          game_number: m[:game]&.strip&.upcase,
          bracket_code: m[:game]&.strip&.upcase,
          division: division,
          phase: phase
        },
        line_no
      )
    end

    def split_matchup(text)
      parts = text.split(/\s+(?:vs\.?|versus|@)\s+/i, 2)
      [ parts[0]&.strip.presence, parts[1]&.strip.presence ]
    end

    def build_parsed_row(fields, line_no)
      start_time_iso, time_error = parse_guam_start_time(fields[:date], fields[:time])
      game_number = fields[:game_number].to_s.strip.presence
      bracket_code = fields[:bracket_code].to_s.strip.presence || game_number
      phase = normalize_phase_token(fields[:phase]) || infer_phase(bracket_code, fields[:notes])

      {
        rowIndex: line_no,
        gameNumber: game_number,
        bracketCode: bracket_code,
        bracketRound: fields[:bracket_round].to_s.strip.downcase.presence,
        bracketSlot: parse_optional_int(fields[:bracket_slot]),
        phase: phase,
        date: fields[:date],
        time: fields[:time],
        startTime: start_time_iso,
        startTimeError: time_error,
        awayTeam: fields[:away_team],
        homeTeam: fields[:home_team],
        division: fields[:division],
        venue: fields[:venue].presence || @default_venue,
        notes: fields[:notes],
        status: fields[:status].to_s.strip.downcase.presence,
        homeScore: parse_optional_int(fields[:home_score]),
        awayScore: parse_optional_int(fields[:away_score])
      }
    end

    def parse_guam_start_time(date_str, time_str)
      return [ nil, "Date is required" ] if date_str.blank?

      date = parse_date_string(date_str)
      return [ nil, "Invalid date '#{date_str}'" ] unless date

      return [ nil, "Tipoff time is required" ] if time_str.blank?

      match = time_str.to_s.strip.match(/\A(\d{1,2}):(\d{2})(?:\s*(am|pm))?\z/i)
      return [ nil, "Invalid time '#{time_str}'" ] unless match

      hour = match[1].to_i
      minute = match[2].to_i
      meridiem = match[3]&.downcase

      if meridiem
        return [ nil, "Invalid 12-hour time '#{time_str}'" ] unless hour.between?(1, 12) && minute.between?(0, 59)

        hour = 0 if meridiem == "am" && hour == 12
        hour += 12 if meridiem == "pm" && hour < 12
      else
        return [ nil, "Invalid 24-hour time '#{time_str}'" ] unless hour.between?(0, 23) && minute.between?(0, 59)
      end

      zone = Time.find_zone!(GUAM_ZONE)
      [ zone.local(date.year, date.month, date.day, hour, minute, 0).iso8601, nil ]
    end

    def parse_date_string(value)
      text = value.to_s.strip
      return nil if text.blank?

      if text.match?(/\A\d{4}-\d{2}-\d{2}\z/)
        return Date.iso8601(text)
      end

      if (m = text.match(/\A(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\z/))
        month = m[1].to_i
        day = m[2].to_i
        year = m[3] ? (m[3].length == 2 ? 2000 + m[3].to_i : m[3].to_i) : @fallback_year
        return Date.new(year, month, day)
      end

      # Month name formats: "July 3, 2027", "Jul 3 2027", "July 3"
      if text.match?(/\A[A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?\z/)
        candidate = text.match?(/\d{4}\z/) ? text : "#{text}, #{@fallback_year}"
        return Date.parse(candidate)
      end

      nil
    rescue Date::Error, ArgumentError
      nil
    end

    def normalize_phase_token(value)
      token = value.to_s.strip.downcase.gsub(/[\s_-]+/, "")
      return nil if token.blank?

      case token
      when "pool", "poolplay" then "pool"
      when "playoff", "playoffs", "bracket" then "playoff"
      when "fatherson", "fs" then "fatherson"
      when "exhibition", "exh" then "exhibition"
      else value.to_s.strip.downcase
      end
    end

    def infer_phase(code, notes)
      notes_str = notes.to_s
      return "fatherson" if notes_str.include?("phase=fatherson") || code.to_s.match?(/\AFS/i)
      return "playoff" if notes_str.include?("phase=playoff") || code.to_s.match?(PLAYOFF_CODE_REGEX)
      return "exhibition" if notes_str.include?("phase=exhibition")

      "pool"
    end

    def canonical_header(raw)
      key = raw.to_s.strip.downcase.gsub(/\s+/, " ")
      HEADER_ALIASES[key] || HEADER_ALIASES[key.delete(" _")]
    end

    def parse_optional_int(value)
      str = value.to_s.strip
      return nil if str.blank?
      return str.to_i if str.match?(/\A\d+\z/)

      nil
    end
  end
end
