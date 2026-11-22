require "test_helper"

class DivisionTest < ActiveSupport::TestCase
  test "default division names match canonical tournament divisions" do
    assert_equal %w[Maroon Gold Platinum Special], Division::DEFAULT_NAMES
  end
end
