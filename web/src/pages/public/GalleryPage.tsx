import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate } from '../../lib/datetime'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui'
import { IconExternal } from '../../components/Icons'

export function GalleryPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicMedia({ limit: 200 }), [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Media archive"
        title="Photos and visual coverage"
        description="A sourced gallery of tournament imagery. Images link back to their original article or media source where available."
      />

      {!data?.mediaAssets.length ? (
        <EmptyState title="No gallery assets loaded" description="Use the admin media tools to add sourced images or imported coverage assets." />
      ) : (
        <div className="gallery-grid">
          {data.mediaAssets.map((asset) => (
            <article key={asset.id} className="gallery-card">
              <img src={asset.imageUrl} alt={asset.caption || asset.title} loading="lazy" />
              <div>
                <span>{asset.source}{asset.takenAt ? ` · ${formatGuamDate(asset.takenAt)}` : ''}</span>
                <h2>{asset.title}</h2>
                {asset.caption && <p>{asset.caption}</p>}
                {asset.articleUrl && <a href={asset.articleUrl} target="_blank" rel="noreferrer">Source article <IconExternal /></a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
