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
          imported = nil

          item.with_lock do
            if item.status == "approved"
              imported = approved_imported_item(item)
            else
              imported = import_item(item)
              item.update!(status: "approved", imported_to_id: imported.id.to_s)
            end
          end

          if imported
            render json: { ingestItem: item.reload.api_json, imported: imported.api_json }
          else
            render json: { errors: [ "Approved ingest item does not reference an imported record" ] }, status: :conflict
          end
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end

        def reject
          item = ContentIngestItem.find(params[:id])

          item.with_lock do
            if item.status == "approved"
              return render json: { errors: [ "Approved ingest item cannot be rejected" ] }, status: :conflict
            end

            item.update!(status: "rejected") unless item.status == "rejected"
          end

          render_record item.reload, key: :ingestItem
        end

        private

        def approved_imported_item(item)
          imported = imported_item(item)
          return imported if imported || item.imported_to_id.present?

          imported = existing_import_for(item)
          item.update!(imported_to_id: imported.id.to_s) if imported
          imported
        end

        def imported_item(item)
          return if item.imported_to_id.blank?

          imported_model_for(item).find_by(id: item.imported_to_id)
        end

        def existing_import_for(item)
          if item.kind == "article"
            ArticleLink.find_by(tournament: item.tournament, url: item.url)
          else
            MediaAsset.find_by(tournament: item.tournament, image_url: item.image_url)
          end
        end

        def imported_model_for(item)
          item.kind == "article" ? ArticleLink : MediaAsset
        end

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
            :source,
            :title,
            :url,
            :image_url,
            :imageUrl,
            :excerpt,
            :confidence,
            :notes
          )

          attrs = {}
          assign_param(attrs, permitted, :tournament_id, :tournament_id, :tournamentId)
          assign_param(attrs, permitted, :kind, :kind)
          assign_param(attrs, permitted, :source, :source)
          assign_param(attrs, permitted, :title, :title)
          assign_param(attrs, permitted, :url, :url)
          assign_param(attrs, permitted, :image_url, :image_url, :imageUrl)
          assign_param(attrs, permitted, :excerpt, :excerpt)
          assign_param(attrs, permitted, :confidence, :confidence)
          assign_param(attrs, permitted, :notes, :notes)
          attrs
        end
      end
    end
  end
end
