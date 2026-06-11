module Api
  module V1
    module Admin
      class ContentIngestItemsController < BaseController
        def index
          items = ContentIngestItem.includes(:tournament).order(created_at: :desc)
          items = items.where(tournament_id: params[:tournamentId]) if params[:tournamentId].present?
          items = items.where(status: params[:status]) if params[:status].present?
          render json: { ingestItems: items.limit(300).map(&:api_json) }
        end

        def show
          render_record ContentIngestItem.find(params[:id]), key: :ingestItem
        end

        def create
          item = ContentIngestItem.new(ingest_item_params)

          if item.save
            render_record item, key: :ingestItem, status: :created
          else
            render_errors item
          end
        end

        def update
          item = ContentIngestItem.find(params[:id])

          if item.update(ingest_item_params)
            render_record item, key: :ingestItem
          else
            render_errors item
          end
        end

        def destroy
          ContentIngestItem.find(params[:id]).destroy!
          head :no_content
        end

        def approve
          item = ContentIngestItem.find(params[:id])
          imported = import_item(item)
          item.update!(status: "approved", imported_to_id: imported.id.to_s)
          render json: { ingestItem: item.api_json, imported: imported.api_json }
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        def reject
          item = ContentIngestItem.find(params[:id])
          item.update!(status: "rejected")
          render_record item, key: :ingestItem
        end

        private

        def import_item(item)
          if item.kind == "article"
            ArticleLink.find_or_create_by!(tournament: item.tournament, url: item.url) do |article|
              article.title = item.title
              article.source = item.source
              article.image_url = item.image_url
              article.excerpt = item.excerpt
            end
          else
            MediaAsset.find_or_create_by!(tournament: item.tournament, image_url: item.image_url) do |media|
              media.title = item.title
              media.source = item.source
              media.article_url = item.url
              media.caption = item.excerpt
            end
          end
        end

        def ingest_item_params
          raw = params.fetch(:ingestItem, params.fetch(:content_ingest_item, params))
          permitted = raw.permit(
            :tournament_id,
            :tournamentId,
            :kind,
            :status,
            :source,
            :title,
            :url,
            :image_url,
            :imageUrl,
            :excerpt,
            :confidence,
            :notes,
            :imported_to_id,
            :importedToId
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :kind, :kind)
          assign_param(attrs, permitted, :status, :status)
          assign_param(attrs, permitted, :source, :source)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :url, :url)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :excerpt, :excerpt)
          assign_param(attrs, permitted, :confidence, :confidence)
          assign_param(attrs, permitted, :notes, :notes)
          assign_param(attrs, permitted, :imported_to_id, :imported_to_id, :importedToId)
          attrs
        end
      end
    end
  end
end
