Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: proc { [ 200, { "Content-Type" => "text/plain" }, [ "ok" ] ] }

  namespace :api do
    namespace :v1 do
      get :me, to: "users#me"

      namespace :public do
        resource :home, only: :show, controller: :home
        resource :today, only: :show, controller: :today
        get "host-year", to: "host_years#show"
        resources :prediction_polls, path: "prediction-polls", only: [] do
          post :vote, to: "prediction_votes#create"
        end
        resources :tournaments, only: [ :index, :show ]
        resources :champions, only: :index
        get "classes/:class_key", to: "classes#show", as: :class_archive
        resources :teams, only: :show
        get :schedule, to: "schedule#index"
        get :standings, to: "standings#index"
        get :bracket, to: "bracket#show"
        get :alerts, to: "alerts#index"
        get :tickets, to: "tickets#show"
        resources :articles, only: :index
        resources :media_assets, path: "media-assets", only: :index
        resources :sponsors, only: :index
      end

      namespace :campaign do
        scope ":campaign_slug" do
          get :settings, to: "settings#show"
          patch :settings, to: "settings#update"
          post "uploads/presign", to: "uploads#presign"
          resources :events, only: [ :index, :create, :update ] do
            post :archive, on: :member
          end
          resources :posts, only: [ :index, :create, :update, :destroy ]

          get "finance/summary", to: "finance#summary"
          get "finance/final-report", to: "finance#final_report"
          get "finance/audit-events", to: "finance#audit_events"
          resources :budget_lines, path: "budget-lines", only: [ :index, :create, :update ] do
            post :archive, on: :member
          end
          resources :pledges, only: [ :index, :create, :update ]
          post "receipts/presign", to: "receipts#presign"
          get "ledger-entries/export", to: "ledger_entries#export", defaults: { format: :csv }
          resources :ledger_entries, path: "ledger-entries", only: [ :index, :create, :update ] do
            post :void, on: :member
            post :approve_reimbursement, path: "approve-reimbursement", on: :member
            post :mark_reimbursed, path: "mark-reimbursed", on: :member
            get :receipt_url, path: "receipt-url", on: :member
          end
        end
      end

      namespace :admin do
        resource :dashboard, only: :show, controller: "dashboard"
        resources :campaigns, only: [ :index, :show, :create, :update ] do
          get :closeout_check, path: "closeout-check", on: :member
          post :archive, on: :member
          post :clone, on: :member
          resources :memberships, controller: "campaign_memberships", only: [ :index, :create, :update ]
          resources :invitations, controller: "campaign_invitations", only: [ :index, :create ] do
            post :revoke, on: :member
          end
        end
        resources :whitelists, only: [ :index, :create, :update ]
        resources :tournaments, only: [ :index, :show, :create, :update ] do
          post :setup, on: :collection
          post :recompute_standings, path: "recompute-standings", on: :member
          post "schedule-import/preview", to: "imports#schedule_preview", on: :member
          post "schedule-import/commit", to: "imports#schedule_commit", on: :member
          post "roster-import/preview", to: "imports#roster_preview", on: :member
          post "roster-import/commit", to: "imports#roster_commit", on: :member
        end
        resources :divisions, only: [ :index, :create, :update ]
        resources :class_cohorts, path: "class-cohorts", only: :index
        resources :teams, only: [ :index, :create, :update, :destroy ]
        resources :roster_entries, path: "roster-entries", only: [ :create, :update, :destroy ] do
          post :bulk, on: :collection
        end
        resources :game_day_notes, path: "game-day-notes", only: [ :index, :create, :update ]
        resources :alerts, only: [ :index, :create, :update, :destroy ]
        resources :prediction_polls, path: "prediction-polls", only: [ :index, :create, :update ]
        resources :games, only: [ :index, :show, :create, :update ] do
          patch :score, on: :member
        end
        resources :articles, only: [ :index, :show, :create, :update, :destroy ]
        resources :media_assets, path: "media-assets", only: [ :index, :show, :create, :update, :destroy ]
        resources :sponsors, only: [ :index, :show, :create, :update, :destroy ]
        post "uploads/presign", to: "uploads#presign"
        resources :content_ingest_items, path: "content-ingest-items", only: [ :index, :show, :create, :update, :destroy ] do
          post :approve, on: :member
          post :reject, on: :member
        end
        get :links, to: "links#index"
        get :missing_links, path: "missing-links", to: "links#missing"
        patch "links/bulk", to: "links#bulk_update"
        post "links/bulk", to: "links#bulk_update"
        get :standings, to: "standings#index"
        post "standings/recompute", to: "standings#recompute"
      end
    end
  end
end
