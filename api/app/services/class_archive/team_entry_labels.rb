module ClassArchive
  module TeamEntryLabels
    CANONICAL_LABELS = {
      "435" => "430-5",
      "815" => "08/15",
      "8/15" => "08/15"
    }.freeze

    module_function

    def canonical_label(value)
      label = value.to_s.strip
      CANONICAL_LABELS.fetch(normalize(label), label)
    end

    def alias_labels_for(value)
      canonical = canonical_label(value)
      CANONICAL_LABELS.filter_map { |source, target| source if target == canonical }
    end

    def canonical_legacy_id(value)
      CANONICAL_LABELS.reduce(value.to_s) do |legacy_id, (source_label, canonical)|
        legacy_id.gsub("-#{stable_slug(source_label)}", "-#{stable_slug(canonical)}")
      end
    end

    def normalize(value)
      value.to_s.downcase.strip.gsub(/\Aclass\s+/, "").gsub(/\s+/, " ")
    end

    def stable_slug(value)
      value.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|\-\z/, "")
    end
  end
end
