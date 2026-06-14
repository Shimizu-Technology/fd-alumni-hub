Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check
  get "health", to: proc { [ 200, { "Content-Type" => "text/plain" }, [ "ok" ] ] }

  namespace :api do
    namespace :v1 do
      get :me, to: "users#me"

      namespace :public do
        resource :home, only: :show, controller: :home
        resources :tournaments, only: [ :index, :show ]
        get :schedule, to: "schedule#index"
        get :standings, to: "standings#index"
        resources :articles, only: :index
        resources :media_assets, path: "media-assets", only: :index
        resources :sponsors, only: :index
      end

      namespace :admin do
        resource :dashboard, only: :show, controller: "dashboard"
        resources :tournaments, only: [ :index, :show, :create, :update ] do
          post :recompute_standings, path: "recompute-standings", on: :member
        end
        resources :divisions, only: [ :index, :create, :update ]
        resources :teams, only: [ :index, :create, :update ]
        resources :games, only: [ :index, :show, :create, :update ]
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
