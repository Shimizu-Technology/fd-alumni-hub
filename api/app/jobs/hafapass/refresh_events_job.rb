module Hafapass
  class RefreshEventsJob < ApplicationJob
    queue_as :default

    def perform(organizer_slug)
      Hafapass::EventsClient.refresh_snapshot!(organizer_slug)
    end
  end
end
