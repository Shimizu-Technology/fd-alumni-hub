require "json"

module ClassArchive
  class Resolver
    DEFAULT_ALIAS_PATH = Rails.root.join("..", "data", "historical", "fd-class-aliases.json").expand_path.freeze

    def self.resolve_cohorts(value)
      new.resolve_cohorts(value)
    end

    def self.class_key(value)
      new.class_key(value)
    end

    def self.class_keys(value)
      new.class_keys(value)
    end

    def resolve_cohorts(value)
      class_keys(value).map { |key| find_or_create_cohort(key) }.uniq(&:id)
    end

    def class_key(value)
      class_keys(value).join("/")
    end

    def class_keys(value)
      label = normalize_label(value)
      return [] if label.blank?

      alias_keys = alias_map[label]
      return alias_keys if alias_keys.present?

      parse_numeric_class_keys(label)
    end

    private

    def alias_map
      @alias_map ||= begin
        payload = DEFAULT_ALIAS_PATH.exist? ? JSON.parse(DEFAULT_ALIAS_PATH.read) : { "aliases" => [] }
        payload.fetch("aliases", []).to_h do |entry|
          [ normalize_label(entry.fetch("label")), entry.fetch("classes").flat_map { |value| parse_numeric_class_keys(value) }.uniq ]
        end
      end
    end

    def normalize_label(value)
      value.to_s.downcase.gsub(/class\s+of/, "").gsub(/class/, "").tr("’'", "").strip.gsub(/\s+/, " ")
    end

    def parse_numeric_class_keys(value)
      text = normalize_label(value)
      text.scan(/\d{2,4}/).filter_map do |segment|
        next unless [ 2, 4 ].include?(segment.length)

        segment.length == 4 ? segment[-2, 2] : segment.rjust(2, "0")
      end.uniq
    end

    def find_or_create_cohort(key)
      graduation_year = graduation_year_for(key)
      ClassCohort.find_or_create_by!(key: key) do |cohort|
        cohort.graduation_year = graduation_year
        cohort.short_label = graduation_year.to_s
        cohort.display_name = "Class of #{graduation_year}"
      end.tap do |cohort|
        next unless cohort.graduation_year != graduation_year || cohort.display_name.blank? || cohort.short_label.blank?

        cohort.update!(graduation_year: graduation_year, short_label: graduation_year.to_s, display_name: "Class of #{graduation_year}")
      end
    end

    def graduation_year_for(key)
      value = Integer(key, 10)
      value >= 50 ? 1900 + value : 2000 + value
    end
  end
end
