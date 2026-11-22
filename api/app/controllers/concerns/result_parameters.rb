module ResultParameters
  private

  def result_params(*sources)
    keys = Games::RecordResult::FIELDS + Games::RecordResult::CONTROL_FIELDS
    sources.each_with_object({}) do |source, attrs|
      next unless source.is_a?(ActionController::Parameters)

      # Reject nested values instead of treating malformed fields as omitted.
      keys.each do |key|
        alternate = key.to_s.camelize(:lower)
        name = source.key?(key) ? key : alternate
        next unless source.key?(name)

        value = source[name]
        attrs[key] = value.is_a?(Array) || value.is_a?(ActionController::Parameters) ? :invalid : value
      end
    end
  end
end
