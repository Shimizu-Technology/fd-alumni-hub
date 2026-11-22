module Tournaments
  class Bootstrap
    class Error < StandardError; end

    Result = Struct.new(:tournament, :divisions, :host_campaign, :budget_lines, :campaign_events, keyword_init: true)

    def self.call(**kwargs)
      new(**kwargs).call
    end

    def initialize(
      tournament: nil,
      tournament_attrs: nil,
      divisions: nil,
      seed_default_divisions: true,
      campaign_attrs: nil,
      budget_lines: [],
      campaign_events: [],
      actor: nil,
      ip_address: nil,
      audit_action: "setup_tournament_campaign",
      audit_changes: {}
    )
      @existing_tournament = tournament
      @tournament_attrs = tournament_attrs
      @divisions_input = divisions
      @seed_default_divisions = seed_default_divisions
      @campaign_attrs = campaign_attrs
      @budget_lines_input = Array(budget_lines)
      @campaign_events_input = Array(campaign_events)
      @actor = actor
      @ip_address = ip_address
      @audit_action = audit_action
      @audit_changes = audit_changes
    end

    def call
      ActiveRecord::Base.transaction do
        tournament = resolve_or_create_tournament!
        divisions = configure_divisions!(tournament)
        host_campaign = create_host_campaign!(tournament)
        created_lines = create_budget_lines!(host_campaign)
        created_events = create_campaign_events!(host_campaign)

        if host_campaign && @actor
          FinanceAuditEvent.record!(
            campaign: host_campaign,
            actor: @actor,
            record: host_campaign,
            action: @audit_action,
            changes: {
              "slug" => host_campaign.slug,
              "status" => host_campaign.status,
              "goal_cents" => host_campaign.goal_cents,
              "divisions_count" => divisions.length,
              "budget_lines_count" => created_lines.length,
              "campaign_events_count" => created_events.length
            }.merge(@audit_changes),
            ip_address: @ip_address
          )
        end

        Result.new(
          tournament: tournament,
          divisions: divisions,
          host_campaign: host_campaign,
          budget_lines: created_lines,
          campaign_events: created_events
        )
      end
    end

    private

    def resolve_or_create_tournament!
      return @existing_tournament if @existing_tournament

      raise Error, "Tournament attributes are required" unless @tournament_attrs.is_a?(Hash) && @tournament_attrs.present?

      attrs = @tournament_attrs.symbolize_keys
      Tournament.create!(
        name: attrs[:name],
        year: attrs[:year],
        start_date: attrs[:start_date],
        end_date: attrs[:end_date],
        status: attrs[:status].presence || "upcoming"
      )
    end

    def configure_divisions!(tournament)
      if @divisions_input.is_a?(Array) && @divisions_input.any?
        @divisions_input.each_with_index.map do |raw, idx|
          spec = raw.respond_to?(:to_h) ? raw.to_h.symbolize_keys : {}
          name = spec[:name].to_s.strip
          slug = spec[:slug].to_s.strip.presence || name.parameterize
          existing = tournament.divisions.where("lower(name) = ? OR slug = ?", name.downcase, slug).first
          next existing if existing

          counts = spec.key?(:counts_for_standings) ? ActiveModel::Type::Boolean.new.cast(spec[:counts_for_standings]) : !name.casecmp?("Special")
          active = spec.key?(:active) ? ActiveModel::Type::Boolean.new.cast(spec[:active]) : true

          tournament.divisions.create!(
            name: name,
            slug: slug,
            position: spec[:position].presence ? spec[:position].to_i : (idx + 1),
            counts_for_standings: counts,
            active: active
          )
        end
      elsif @seed_default_divisions
        tournament.ensure_default_divisions!
      else
        tournament.divisions.ordered.to_a
      end
    end

    def create_host_campaign!(tournament)
      return nil unless @campaign_attrs.is_a?(Hash) && @campaign_attrs.present?

      if HostCampaign.exists?(tournament_id: tournament.id)
        raise Error, "Tournament '#{tournament.year} #{tournament.name}' already has a host campaign"
      end

      attrs = @campaign_attrs.symbolize_keys
      cohort = resolve_class_cohort!(attrs)

      title = attrs[:title].to_s.strip.presence || "#{cohort.display_name} Host Year (#{tournament.year})"
      slug = attrs[:slug].to_s.strip.downcase.presence || "#{tournament.year}-class-of-#{cohort.graduation_year}"

      HostCampaign.create!(
        tournament: tournament,
        class_cohort: cohort,
        title: title,
        slug: slug,
        goal_cents: attrs[:goal_cents].to_i,
        fdaa_upfront_cents: attrs[:fdaa_upfront_cents].to_i,
        fdaa_ticket_share_bps: attrs[:fdaa_ticket_share_bps].to_i,
        status: "draft",
        featured: false,
        public_meter_enabled: false,
        include_fdaa_in_public_meter: false
      )
    end

    def resolve_class_cohort!(attrs)
      if attrs[:class_cohort_id].present?
        return ClassCohort.find(attrs[:class_cohort_id])
      end

      year_val = Integer(attrs[:host_class_year].to_s.strip, 10, exception: false)
      raise Error, "A valid host class graduation year (1950-2099) or classCohortId is required" unless year_val&.between?(1950, 2099)

      cohorts = ClassArchive::Resolver.resolve_cohorts(year_val.to_s)
      cohort = cohorts.first
      raise Error, "Could not resolve class cohort for graduation year #{year_val}" unless cohort

      cohort
    end

    def create_budget_lines!(campaign)
      return [] unless campaign && @budget_lines_input.any?

      @budget_lines_input.each_with_index.map do |raw, idx|
        spec = raw.respond_to?(:to_h) ? raw.to_h.symbolize_keys : {}
        campaign.budget_lines.create!(
          kind: spec[:kind],
          category: spec[:category],
          budget_cents: spec[:budget_cents].to_i,
          position: spec[:position].presence ? spec[:position].to_i : (idx + 1),
          notes: spec[:notes]
        )
      end
    end

    def create_campaign_events!(campaign)
      return [] unless campaign && @campaign_events_input.any?

      @campaign_events_input.each_with_index.map do |raw, idx|
        spec = raw.respond_to?(:to_h) ? raw.to_h.symbolize_keys : {}
        campaign.campaign_events.create!(
          kind: spec[:kind],
          title: spec[:title],
          venue: spec[:venue],
          description: spec[:description],
          position: spec[:position].presence ? spec[:position].to_i : (idx + 1),
          status: "planned",
          date_label: spec[:date_label].presence || "TBD",
          starts_at: nil,
          ends_at: nil,
          public_visible: false
        )
      end
    end
  end
end
