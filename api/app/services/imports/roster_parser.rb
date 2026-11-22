require "csv"

module Imports
  class RosterParser
    MAX_BYTES = 512_000
    MAX_ROWS = 1000

    class ParseError < StandardError; end

    Result = Struct.new(:detected_format, :rows, keyword_init: true)

    HEADER_ALIASES = {
      "team" => :team,
      "team_name" => :team,
      "teamname" => :team,
      "class" => :team,
      "name" => :name,
      "player" => :name,
      "player_name" => :name,
      "playername" => :name,
      "jersey" => :jersey_number,
      "jersey_number" => :jersey_number,
      "jerseynumber" => :jersey_number,
      "#" => :jersey_number,
      "number" => :jersey_number,
      "position" => :position,
      "pos" => :position,
      "nickname" => :nickname,
      "nick" => :nickname
    }.freeze

    def self.call(content:, format: "auto")
      new(content: content, format: format).call
    end

    def initialize(content:, format: "auto")
      @content = content.to_s
      @format = format.to_s.strip.downcase.presence || "auto"
    end

    def call
      raise ParseError, "Roster content is required" if @content.strip.blank?
      raise ParseError, "Roster content exceeds #{MAX_BYTES / 1024} KB limit" if @content.bytesize > MAX_BYTES

      detected = detect_format
      rows = case detected
      when "csv"
        parse_csv
      when "text"
        parse_text_blocks
      else
        raise ParseError, "Unsupported roster format: #{@format}"
      end

      raise ParseError, "Roster import exceeds maximum of #{MAX_ROWS} rows (#{rows.length} found)" if rows.length > MAX_ROWS
      raise ParseError, "No roster rows could be parsed from the input" if rows.empty?

      Result.new(detected_format: detected, rows: rows)
    end

    private

    def detect_format
      return @format if %w[csv text].include?(@format)

      first_line = @content.lines.map(&:strip).find(&:present?).to_s
      if first_line.include?(",") && csv_header_line?(first_line)
        "csv"
      else
        "text"
      end
    end

    def csv_header_line?(line)
      cells = CSV.parse_line(line) || []
      normalized = cells.map { |c| canonical_header(c) }.compact
      normalized.include?(:team) && normalized.include?(:name)
    rescue CSV::MalformedCSVError
      false
    end

    def parse_csv
      table = CSV.parse(@content.lstrip, headers: true, skip_blanks: true)
      mapped = table.headers.each_with_object({}) do |raw_header, map|
        key = canonical_header(raw_header)
        map[raw_header] = key if key
      end

      unless mapped.values.include?(:team) && mapped.values.include?(:name)
        raise ParseError, "CSV must include team and name (or player) columns"
      end

      rows = []
      table.each_with_index do |csv_row, idx|
        fields = {}
        mapped.each do |raw_header, key|
          fields[key] = csv_row[raw_header].to_s.strip.presence
        end
        next if fields.values.all?(&:nil?)

        rows << {
          rowIndex: idx + 2,
          team: fields[:team],
          name: fields[:name],
          jerseyNumber: fields[:jersey_number],
          position: fields[:position],
          nickname: fields[:nickname]
        }
      end
      rows
    rescue CSV::MalformedCSVError => e
      raise ParseError, "Invalid CSV syntax: #{e.message}"
    end

    def parse_text_blocks
      rows = []
      current_team = nil

      @content.each_line.with_index(1) do |raw_line, line_no|
        line = raw_line.strip
        next if line.blank? || line.start_with?("#")

        if (m = line.match(/\A(?:team|class)\s*:\s*(.+)\z/i))
          current_team = m[1].strip.presence
          next
        end

        parsed = parse_player_line(line)
        next unless parsed

        rows << {
          rowIndex: line_no,
          team: current_team,
          name: parsed[:name],
          jerseyNumber: parsed[:jersey_number],
          position: parsed[:position],
          nickname: parsed[:nickname]
        }
      end

      rows
    end

    def parse_player_line(line)
      parts = line.split(",").map(&:strip).reject(&:blank?)
      if parts.length > 1
        if parts[0].match?(/\A#?\d{1,3}\z/)
          return {
            jersey_number: parts[0].delete_prefix("#"),
            name: parts[1],
            position: parts[2],
            nickname: parts[3..]&.join(", ").presence
          }
        elsif parts[1].match?(/\A#?\d{1,3}\z/)
          return {
            name: parts[0],
            jersey_number: parts[1].delete_prefix("#"),
            position: parts[2],
            nickname: parts[3..]&.join(", ").presence
          }
        else
          return {
            name: parts[0],
            jersey_number: nil,
            position: parts[1],
            nickname: parts[2..]&.join(", ").presence
          }
        end
      end

      if (m = line.match(/\A#?(\d{1,3})\s+(.+)\z/))
        { jersey_number: m[1], name: m[2].strip, position: nil, nickname: nil }
      else
        { jersey_number: nil, name: line, position: nil, nickname: nil }
      end
    end

    def canonical_header(raw)
      key = raw.to_s.strip.downcase.gsub(/\s+/, " ")
      HEADER_ALIASES[key] || HEADER_ALIASES[key.delete(" _")]
    end
  end
end
