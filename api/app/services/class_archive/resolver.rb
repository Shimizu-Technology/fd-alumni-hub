require "json"

module ClassArchive
  class Resolver
    DEFAULT_ALIAS_PATH = Rails.root.join("..", "data", "historical", "fd-class-aliases.json").expand_path.freeze

    def self.instance
      @instance ||= new
    end

    def self.resolve_cohorts(value)
      instance.resolve_cohorts(value)
    end

    def self.class_key(value)
      instance.class_key(value)
    end

    def self.class_keys(value)
      instance.class_keys(value)
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
        payload.fetch("aliases", []).each_with_object({}) do |entry, aliases|
          keys = entry.fetch("classes").flat_map { |value| parse_numeric_class_keys(value) }.uniq
          labels = [ entry.fetch("label"), *entry.fetch("aliases", []) ]
          labels.each { |label| aliases[normalize_label(label)] = keys }
        end
      end
    end

    def normalize_label(value)
      value.to_s.downcase.gsub(/class\s+of/, "").gsub(/class/, "").tr("’'", "").strip.gsub(/\s+/, " ")
    end

    def parse_numeric_class_keys(value)
      text = normalize_label(value)
      text.to_enum(:scan, /\bad\s*(\d{1,2})\b|\d{2,4}/).filter_map do
        match = Regexp.last_match
        segment = match[0]
        next ad_class_key(match[1]) if match[1]
        next unless [ 2, 4 ].include?(segment.length)

        segment.length == 4 ? segment[-2, 2] : segment.rjust(2, "0")
      end.uniq
    end

    def ad_class_key(value)
      digits = value.to_s.rjust(1, "0")
      digits.length == 1 ? "8#{digits}" : digits[-2, 2].rjust(2, "0")
    end

    def find_or_create_cohort(key)
      graduation_year = graduation_year_for(key)
      cohort = ClassCohort.find_by(key: key) || safely_create_cohort(key, graduation_year)
      sync_cohort_metadata(cohort, graduation_year)
    end

    def safely_create_cohort(key, graduation_year)
      ClassCohort.create!(
        key: key,
        graduation_year: graduation_year,
        short_label: graduation_year.to_s,
        display_name: "Class of #{graduation_year}"
      )
    rescue ActiveRecord::RecordNotUnique
      ClassCohort.find_by!(key: key)
    end

    def sync_cohort_metadata(cohort, graduation_year)
      if cohort.graduation_year != graduation_year || cohort.display_name.blank? || cohort.short_label.blank?
        cohort.update!(graduation_year: graduation_year, short_label: graduation_year.to_s, display_name: "Class of #{graduation_year}")
      end

      cohort
    end

    def graduation_year_for(key)
      value = Integer(key, 10)
      value >= 50 ? 1900 + value : 2000 + value
    end
  end
end
