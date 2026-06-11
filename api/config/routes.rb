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
        resources :tournaments, only: [ :index, :show, :create, :update ] do
          post :recompute_standings, path: "recompute-standings", on: :member
        end
        resources :teams, only: [ :index, :create, :update ]
        resources :games, only: [ :index, :show, :create, :update ]
      end
    end
  end
end
