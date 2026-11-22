module Access
  class Policy
    MODULES = {
      "game-day" => %w[tonights_menu_and_news],
      "games" => %w[schedule_and_teams],
      "scorekeeper" => %w[scores_and_stats brackets],
      "campaign/host-year" => %w[fundraisers_and_sponsors],
      "campaign/finance" => %w[finance_and_reimbursements],
      "news" => %w[history_and_media],
      "people" => %w[manage_admins],
      "audit" => %w[view_audit_log]
    }.freeze
    LEGACY_CAMPAIGN_ACTIONS = {
      "chair" => { "fundraisers_and_sponsors" => %w[view edit publish], "finance_and_reimbursements" => %w[view view_receipts approve export] },
      "treasurer" => { "fundraisers_and_sponsors" => %w[view], "finance_and_reimbursements" => Capabilities::ACTIONS.fetch("finance_and_reimbursements") },
      "board" => { "fundraisers_and_sponsors" => %w[view], "finance_and_reimbursements" => %w[view view_receipts export] }
    }.freeze
    STAFF_CAPABILITIES = %w[tonights_menu_and_news schedule_and_teams scores_and_stats brackets fundraisers_and_sponsors history_and_media].freeze

    def initialize(user)
      @user = user
    end

    def super_admin?
      !!(@user&.active? && @user.super_admin?)
    end

    def allows?(capability, action, scope_type: "site", scope_id: nil)
      super_admin? || capabilities.any? do |entry|
        entry[:capability] == capability && entry[:actions].include?(action) &&
          (entry[:allScopes] || (scope_id && entry[:scopeType] == scope_type && entry[:scopeIds].include?(scope_id.to_s)))
      end
    end

    def explicitly_allows?(capability, action, scope_type:, scope_id:)
      return true if super_admin?

      grants = @user.permission_grants.active.where(capability: capability)
      grants.where(scope_type: "site").or(grants.where(scope_type: scope_type, scope_id: scope_id))
        .any? { |grant| grant.actions.include?(action) }
    end

    def scope_ids(type, capability: nil, action: nil)
      return [] unless @user&.active?

      model = { "tournament" => Tournament, "campaign" => HostCampaign }.fetch(type)
      entries = capabilities.select do |entry|
        (!capability || entry[:capability] == capability) && (!action || entry[:actions].include?(action))
      end
      return model.pluck(:id) if super_admin?

      if type == "campaign"
        site_grants = @user.permission_grants.active.where(scope_type: "site")
        return model.pluck(:id) if site_grants.any? { |grant| (!capability || grant.capability == capability) && (!action || grant.actions.include?(action)) }
      elsif entries.any? { |entry| entry[:allScopes] }
        return model.pluck(:id)
      end

      entries.select { |entry| entry[:scopeType] == type }.flat_map { |entry| entry[:scopeIds] }.uniq.map(&:to_i)
    end

    def capabilities
      return [] unless @user&.active?
      return @capabilities if defined?(@capabilities)

      rows = super_admin? ? Capabilities::ACTIONS.map { |key, actions| [ key, actions, "site", nil ] } : effective_rows
      @capabilities = rows.group_by { |key, actions, type, _id| [ key, actions.sort, type ] }.map do |(key, actions, type), grants|
        { capability: key, actions: actions, scopeType: type, scopeIds: grants.filter_map { |row| row.last&.to_s }.uniq, allScopes: type == "site" }
      end
    end

    def workspace
      modules = MODULES.filter_map { |path, keys| path if capabilities.any? { |entry| keys.include?(entry[:capability]) } }
      task_modules = modules - %w[people audit]
      if super_admin? || (task_modules.length > 1 && task_modules != %w[campaign/host-year campaign/finance])
        modules.unshift("work")
        home = "/admin"
      else
        primary = ("campaign/finance" if task_modules == %w[campaign/host-year campaign/finance]) || modules.find { |path| !%w[people audit].include?(path) } || modules.first
        primary = "standings" if primary == "scorekeeper" && capabilities.none? { |entry| entry[:capability] == "scores_and_stats" && entry[:actions].include?("view") }
        home = primary ? "/admin/#{primary}" : "/"
      end
      { isSuperAdmin: super_admin?, capabilities: capabilities, allowedModules: modules, defaultWorkspacePath: home }
    end

    private

    def effective_rows
      grants = @user.permission_grants
      rows = grants.active.pluck(:capability, :actions, :scope_type, :scope_id)
      legacy = case @user.role
      when "staff" then Capabilities::ACTIONS.slice(*STAFF_CAPABILITIES)
      when "scorekeeper" then Presets::DEFINITIONS.fetch("scorekeeper").last
      else {}
      end
      # Once a duty is explicitly managed, its legacy global fallback must stop.
      rows.concat((legacy.except(*grants.distinct.pluck(:capability))).map { |key, actions| [ key, actions, "site", nil ] })
      @user.campaign_memberships.active.pluck(:host_campaign_id, :role).each do |id, role|
        explicit = grants.where(scope_type: "campaign", scope_id: id).pluck(:capability)
        LEGACY_CAMPAIGN_ACTIONS.fetch(role).except(*explicit).each do |key, actions|
          rows << [ key, actions, "campaign", id ]
        end
      end
      rows
    end
  end
end
