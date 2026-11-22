module HostCampaigns
  class HandoffStatus
    OFFICER_ROLES = %w[chair treasurer].freeze
    CAMPAIGN_CAPABILITIES = %w[fundraisers_and_sponsors finance_and_reimbursements].freeze

    def initialize(campaign, user, policy: Access::Policy.new(user))
      @campaign = campaign
      @user = user
      @policy = policy
    end

    def can_view?(campaign)
      return true if @policy.super_admin?

      # Implicit staff access to tournament sponsors does not grant access to campaign workspaces.
      @viewable_campaign_ids ||= CAMPAIGN_CAPABILITIES.flat_map do |capability|
        @policy.scope_ids("campaign", capability: capability, action: "view")
      end
      @viewable_campaign_ids.include?(campaign.id)
    end

    def call
      {
        campaign: summary(@campaign).merge(
          hostClassYear: @campaign.class_cohort.graduation_year,
          tournamentId: @campaign.tournament_id.to_s,
          goalCents: @campaign.goal_cents,
          fdaaUpfrontCents: @campaign.fdaa_upfront_cents,
          fdaaTicketShareBps: @campaign.fdaa_ticket_share_bps,
          publicMeterEnabled: @campaign.public_meter_enabled,
          featured: @campaign.featured,
          donationUrl: @campaign.donation_url,
          hafapassOrganizerSlug: @campaign.hafapass_organizer_slug
        ),
        closeout: closeout,
        onboarding: onboarding,
        relatedNextCampaign: related_next_campaign,
        canPrepareNextYear: @user.admin?
      }
    end

    private

    def summary(campaign)
      {
        id: campaign.id.to_s, slug: campaign.slug, title: campaign.title,
        status: campaign.status, tournamentYear: campaign.tournament.year
      }
    end

    def closeout
      check = CloseoutCheck.call(@campaign)
      check.merge(
        boardReportReady: check[:ready],
        checklist: [
          item("unfinalized_games", check[:unfinalizedGamesCount].zero?, "blocker", check[:unfinalizedGamesCount]),
          item("pending_reimbursements", check[:pendingReimbursementsCount].zero?, "blocker", check[:pendingReimbursementsCount]),
          item("missing_receipts", check[:missingReceiptsCount].zero?, "warning", check[:missingReceiptsCount]),
          item("open_cash_pledges", check[:openCashPledgesCount].zero?, "warning", check[:openCashPledgesCount]),
          item("champions_confirmed", check[:championsRecordedCount].positive?, "warning", check[:championsRecordedCount]),
          item("board_report_ready", check[:ready]),
          item("archive", @campaign.archived?)
        ]
      )
    end

    def item(code, complete, severity = "step", count = nil)
      { code: code, complete: complete, severity: severity, count: count }
    end

    def onboarding
      return unless @campaign.status.in?(%w[draft active])

      events = @campaign.campaign_events.not_archived.where(kind: %w[fundraiser golf merch_drop]).where.not(status: "cancelled")
      {
        fundingAssumptionsPresent: @campaign.fdaa_upfront_cents.present? && @campaign.fdaa_ticket_share_bps.present?,
        publicCopyConfigured: @campaign.description.present? && @campaign.title.present?,
        goalConfigured: @campaign.goal_cents.positive?,
        ticketLinksSet: ticket_links_set?(events),
        donationLinkSet: @campaign.donation_url.present?,
        firstFundraiserCreated: events.exists?,
        firstFundraiserScheduled: events.where.not(starts_at: nil).exists?,
        published: !@campaign.draft?,
        featured: @campaign.featured,
        officers: officer_details
      }
    end

    def ticket_links_set?(events)
      @campaign.hafapass_organizer_slug.present? || events
        .where.not(hafapass_event_id: nil)
        .or(events.where.not(hafapass_event_slug: nil))
        .or(events.where.not(hafapass_distribution_code: nil))
        .or(events.where.not(external_url: nil))
        .exists?
    end

    def officer_details
      return unless @policy.allows?("manage_admins", "view", scope_type: "campaign", scope_id: @campaign.id) ||
        (@user.campaign_roles_for(@campaign) & OFFICER_ROLES).any?

      memberships = @campaign.campaign_memberships.active.where(role: OFFICER_ROLES)
        .joins(:user).merge(User.active).includes(:user).to_a
      invitations = @campaign.campaign_invitations.where(role: OFFICER_ROLES).where(revoked_at: nil).recent_first
      OFFICER_ROLES.map do |role|
        members = memberships.select { |membership| membership.role == role }
        invites = invitations.select { |invitation| invitation.role == role }
        {
          role: role,
          invited: invites.any? || members.any?,
          accepted: members.any?,
          invitations: invites.map { |invitation| invitation.slice(:email, :status) },
          pendingActions: Access::Policy::LEGACY_CAMPAIGN_ACTIONS.fetch(role),
          members: members.map do |membership|
            user = membership.user
            { email: user.email, name: user.full_name, actions: permitted_actions(user) }
          end
        }
      end
    end

    def permitted_actions(user)
      policy = Access::Policy.new(user)
      site_actions = user.permission_grants.active.where(scope_type: "site", capability: CAMPAIGN_CAPABILITIES)
        .pluck(:capability, :actions).group_by(&:first)

      CAMPAIGN_CAPABILITIES.index_with do |capability|
        next Access::Capabilities::ACTIONS.fetch(capability) if policy.super_admin?

        campaign_actions = policy.capabilities.select do |entry|
          entry[:capability] == capability && entry[:scopeType] == "campaign" && entry[:scopeIds].include?(@campaign.id.to_s)
        end.flat_map { |entry| entry[:actions] }
        campaign_actions | site_actions.fetch(capability, []).flat_map(&:last)
      end
    end

    def related_next_campaign
      scope = HostCampaign.includes(:tournament).joins(:tournament)
        .where("tournaments.year > ?", @campaign.tournament.year)
      clone_id = FinanceAuditEvent.where(action: "clone_campaign", record_type: "HostCampaign")
        .where("changes_json ->> 'cloned_from_campaign_id' = ?", @campaign.id.to_s)
        .where(host_campaign_id: scope.select(:id)).order(id: :desc).pick(:host_campaign_id)
      related = scope.find_by(id: clone_id) if clone_id
      related ||= scope.where(tournaments: { year: @campaign.tournament.year + 1 }).order(:id).first
      summary(related).merge(hasAccess: can_view?(related)) if related
    end
  end
end
