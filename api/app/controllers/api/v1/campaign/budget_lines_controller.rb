module Api
  module V1
    module Campaign
      class BudgetLinesController < BaseController
        before_action -> { require_campaign_access!("finance_and_reimbursements", "view", "board", "chair", "treasurer") }, only: :index
        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :create
        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :update
        before_action -> { require_campaign_access!("finance_and_reimbursements", "record", "treasurer") }, only: :archive
        before_action :require_campaign_writable!, only: [ :create, :update, :archive ]

        def index
          lines = @campaign.budget_lines.ordered
          lines = lines.active unless ActiveModel::Type::Boolean.new.cast(params[:includeArchived])
          actuals = @campaign.ledger_entries.live.where.not(budget_line_id: nil).group(:budget_line_id).sum(:amount_cents)

          render json: {
            budgetLines: lines.map { |line| line.api_json(actual_cents: actuals[line.id].to_i) }
          }
        end

        def create
          attrs = budget_line_params
          return if performed?

          line = @campaign.budget_lines.build(attrs)

          BudgetLine.transaction do
            unless line.save
              render_errors(line)
              raise ActiveRecord::Rollback
            end

            record_audit!(
              record: line,
              action: "create",
              changes: { "kind" => line.kind, "category" => line.category, "budget_cents" => line.budget_cents }
            )
          end
          return if performed?

          render json: { budgetLine: line.api_json(actual_cents: 0) }, status: :created
        end

        def update
          attrs = budget_line_params
          return if performed?

          line = @campaign.budget_lines.find(params[:id])
          if line.archived?
            return render json: { error: "Archived budget lines are read-only." }, status: :unprocessable_entity
          end

          BudgetLine.transaction do
            line.lock!
            line.assign_attributes(attrs)
            changes = line.changes
            unless line.save
              render_errors(line)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: line, action: "update", changes: changes) if changes.any?
          end
          return if performed?

          actual = @campaign.ledger_entries.live.where(budget_line_id: line.id).sum(:amount_cents).to_i
          render json: { budgetLine: line.api_json(actual_cents: actual) }
        end

        def archive
          line = @campaign.budget_lines.find(params[:id])
          actual = @campaign.ledger_entries.live.where(budget_line_id: line.id).sum(:amount_cents).to_i
          return render json: { budgetLine: line.api_json(actual_cents: actual) } if line.archived?

          BudgetLine.transaction do
            line.update!(archived_at: Time.current)
            record_audit!(record: line, action: "archive", changes: { "archived_at" => line.archived_at.iso8601 })
          end

          render json: { budgetLine: line.api_json(actual_cents: actual) }
        end

        private

        def budget_line_params
          raw = extract_object_params(:budgetLine, :budget_line)
          return {} unless raw

          permitted = raw.permit(:kind, :category, :budget_cents, :budgetCents, :position, :notes)

          attrs = {}
          assign_param(attrs, permitted, :kind, :kind)
          assign_param(attrs, permitted, :category, :category)
          assign_param(attrs, permitted, :budget_cents, :budget_cents, :budgetCents)
          assign_param(attrs, permitted, :position, :position)
          assign_param(attrs, permitted, :notes, :notes)
          attrs
        end
      end
    end
  end
end
