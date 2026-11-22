import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import { EmptyState, LoadingState, PageHeader, SectionUnavailable } from '../../components/ui'
import { IconExternal } from '../../components/Icons'

export function GalleryPage() {
  const { data, loading, error, reload } = useAsync(() => api.publicMedia({ limit: 200 }), [])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Media archive"
        title="Photos and visual coverage"
        description="A sourced gallery of tournament imagery. Images link back to their original article or media source where available."
      />

      {loading && !data ? (
        <LoadingState label="Loading photo gallery" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Photo gallery is temporarily unavailable"
          description="Could not reach the media archive API right now."
          onRetry={reload}
        />
      ) : !data?.mediaAssets.length ? (
        <EmptyState title="No gallery photos posted yet" description="Photos and visual coverage will appear here once tournament media is approved." />
      ) : (
        <div className="gallery-grid">
          {data.mediaAssets.map((asset) => (
            <article key={asset.id} className="gallery-card">
              <img src={asset.imageUrl} alt={asset.caption || asset.title} loading="lazy" />
              <div>
                <span>{asset.source}{asset.takenAt ? ` · ${formatGuamDate(asset.takenAt)}` : ''}</span>
                <h2>{asset.title}</h2>
                {asset.game && <small>{gameOptionLabel(asset.game)}</small>}
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
