module HostCampaigns
  class Clone
    class Error < StandardError; end

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(
      source_campaign:,
      actor:,
      ip_address: nil,
      target_tournament_id: nil,
      tournament_attrs: nil,
      class_cohort_id: nil,
      host_class_year: nil,
      title: nil,
      slug: nil,
      goal_cents: nil,
      copy_divisions: true,
      copy_budget_categories: true,
      copy_budget_amounts: false,
      copy_event_templates: true
    )
      @source = source_campaign
      @actor = actor
      @ip_address = ip_address
      @target_tournament_id = target_tournament_id
      @tournament_attrs = tournament_attrs
      @class_cohort_id = class_cohort_id
      @host_class_year = host_class_year
      @title = title
      @slug = slug
      @goal_cents = goal_cents
      @copy_divisions = copy_divisions
      @copy_budget_categories = copy_budget_categories
      @copy_budget_amounts = copy_budget_amounts
      @copy_event_templates = copy_event_templates
    end

    def call
      Audit::Context.with { perform }
    end

    private def perform
      target_tournament = resolve_existing_target_tournament!
      validate_new_tournament_year! unless target_tournament

      divisions_spec = if @copy_divisions && @source.tournament
        @source.tournament.divisions.active.ordered.map do |division|
          {
            name: division.name,
            slug: division.slug,
            position: division.position,
            counts_for_standings: division.counts_for_standings,
            active: true
          }
        end
      end

      budget_lines_spec = if @copy_budget_categories
        @source.budget_lines.active.ordered.map do |line|
          {
            kind: line.kind,
            category: line.category,
            budget_cents: @copy_budget_amounts ? line.budget_cents : 0,
            position: line.position,
            notes: nil
          }
        end
      else
        []
      end

      # Strict event template allowlist (Design §5.3): NEVER copy dates, HafaPass IDs/slugs/codes, or external/image URLs.
      event_templates_spec = if @copy_event_templates
        @source.campaign_events.not_archived.ordered.map do |event|
          {
            kind: event.kind,
            title: event.title,
            venue: event.venue,
            description: event.description,
            position: event.position,
            date_label: "TBD"
          }
        end
      else
        []
      end

      effective_goal = if @goal_cents.present?
        parsed_goal = Integer(@goal_cents.to_s.strip, 10, exception: false)
        raise Error, "Goal cents must be a non-negative integer" if parsed_goal.nil? || parsed_goal.negative?

        parsed_goal
      else
        @source.goal_cents
      end

      # Strict campaign copy allowlist (Design §5.3 M7):
      # ONLY fdaa_upfront_cents and fdaa_ticket_share_bps carry over from source HostCampaign.
      # status="draft", featured=false, public_meter_enabled=false, include_fdaa_in_public_meter=false,
      # and all URLs/descriptions/donation/HafaPass fields remain fresh/nil.
      campaign_attrs = {
        class_cohort_id: @class_cohort_id,
        host_class_year: @host_class_year,
        title: @title,
        slug: @slug,
        goal_cents: effective_goal,
        fdaa_upfront_cents: @source.fdaa_upfront_cents,
        fdaa_ticket_share_bps: @source.fdaa_ticket_share_bps
      }

      Tournaments::Bootstrap.call(
        tournament: target_tournament,
        tournament_attrs: target_tournament ? nil : @tournament_attrs,
        divisions: divisions_spec,
        seed_default_divisions: false,
        campaign_attrs: campaign_attrs,
        budget_lines: budget_lines_spec,
        campaign_events: event_templates_spec,
        actor: @actor,
        ip_address: @ip_address,
        audit_action: "clone_campaign",
        audit_changes: {
          "cloned_from_campaign_id" => @source.id.to_s,
          "cloned_from_slug" => @source.slug,
          "copy_divisions" => @copy_divisions,
          "copy_budget_categories" => @copy_budget_categories,
          "copy_budget_amounts" => @copy_budget_amounts,
          "copy_event_templates" => @copy_event_templates
        }
      )
    end

    private

    def resolve_existing_target_tournament!
      return nil if @target_tournament_id.blank?

      target = Tournament.find_by(id: @target_tournament_id)
      raise Error, "Target tournament not found" unless target

      if target.id == @source.tournament_id
        raise Error, "Target tournament must be different from the source campaign's tournament"
      end

      if HostCampaign.exists?(tournament_id: target.id)
        raise Error, "Tournament '#{target.year} #{target.name}' already has a host campaign"
      end

      target
    end

    def validate_new_tournament_year!
      return unless @tournament_attrs.is_a?(Hash) && @tournament_attrs.present?

      raw_year = @tournament_attrs[:year] || @tournament_attrs["year"]
      year_val = Integer(raw_year.to_s.strip, 10, exception: false)
      return unless year_val && Tournament.exists?(year: year_val)

      raise Error, "A tournament for year #{year_val} already exists; pass targetTournamentId to attach to it instead"
    end
  end
end
