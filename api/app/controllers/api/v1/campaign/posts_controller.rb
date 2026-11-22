module Api
  module V1
    module Campaign
      class PostsController < BaseController
        before_action -> { require_campaign_role!("board", "chair", "treasurer") }, only: [ :index ]
        before_action -> { require_campaign_role!("chair") }, only: [ :create, :update, :destroy ]
        before_action :require_campaign_writable!, only: [ :create, :update, :destroy ]

        def index
          posts = @campaign.campaign_posts.includes(:author).order(pinned: :desc, created_at: :desc, id: :desc)
          render json: { posts: posts.map(&:admin_json) }
        end

        def create
          post = @campaign.campaign_posts.build(post_params.merge(author: current_user))

          CampaignPost.transaction do
            unless post.save
              render_errors(post)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: post, action: "create_post", changes: { "title" => post.title, "published_at" => post.published_at&.iso8601 })
          end
          return if performed?

          render json: { post: post.admin_json }, status: :created
        end

        def update
          post = @campaign.campaign_posts.find(params[:id])

          CampaignPost.transaction do
            post.assign_attributes(post_params)
            changes = post.changes
            unless post.save
              render_errors(post)
              raise ActiveRecord::Rollback
            end

            record_audit!(record: post, action: "update_post", changes: changes) if changes.any?
          end
          return if performed?

          render json: { post: post.admin_json }
        end

        def destroy
          post = @campaign.campaign_posts.find(params[:id])

          CampaignPost.transaction do
            record_audit!(
              record: post,
              action: "delete_post",
              changes: {
                "title" => post.title,
                "body" => post.body,
                "image_url" => post.image_url,
                "published_at" => post.published_at&.iso8601
              }
            )
            post.destroy!
          end

          head :no_content
        end

        private

        def post_params
          raw = params.fetch(:post, params)
          permitted = raw.permit(
            :title, :body,
            :image_url, :imageUrl,
            :published_at, :publishedAt,
            :pinned
          )

          attrs = {}
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :body, :body)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :published_at, :published_at, :publishedAt)
          assign_param(attrs, permitted, :pinned, :pinned)
          attrs
        end
      end
    end
  end
end
