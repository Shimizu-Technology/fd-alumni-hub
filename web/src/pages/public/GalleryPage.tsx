import { useState } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import { safeHttpsHref } from '../../lib/urls'
import { EmptyState, LoadingState, PageHeader, SectionUnavailable } from '../../components/ui'
import { IconExternal } from '../../components/Icons'
import { VideoEmbedCard } from '../../components/VideoEmbedCard'

const filters = [
  { label: 'All', value: undefined },
  { label: 'Photos', value: 'photo' },
  { label: 'Videos', value: 'video' },
] as const

function isScheduleGraphic(asset: { title: string; imageUrl?: string | null }) {
  const text = `${asset.title} ${asset.imageUrl || ''}`
  return /\b(schedule|playoffs[_-]?final|bracket)\b/i.test(text)
}

export function GalleryPage() {
  const [mediaType, setMediaType] = useState<'photo' | 'video'>()
  const { data, loading, error, reload } = useAsync(async () => {
    const result = await api.publicMedia({ archive: true, limit: 200, mediaType })
    return { ...result, mediaType }
  }, [mediaType])
  const rawAssets = data?.mediaType === mediaType ? data?.mediaAssets : undefined
  const assets = rawAssets
    ? [...rawAssets].sort((a, b) => Number(isScheduleGraphic(a)) - Number(isScheduleGraphic(b)))
    : undefined

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Media archive"
        title="Tournament photos and videos"
        description="Browse tournament photography, broadcasts, and game highlights from across the archive."
      />

      <div className="gallery-filters" role="group" aria-label="Media type">
        {filters.map(({ label, value }) => (
          <button key={label} type="button" className={`btn small ${mediaType === value ? 'primary' : 'secondary'}`}
            aria-pressed={mediaType === value} onClick={() => setMediaType(value)}>{label}</button>
        ))}
      </div>

      {loading && !assets ? (
        <LoadingState label="Loading media gallery" />
      ) : error && !assets ? (
        <SectionUnavailable title="Media gallery is temporarily unavailable" description="Could not reach the media archive API right now." onRetry={reload} />
      ) : !assets?.length ? (
        <EmptyState title={mediaType === 'photo' ? 'No photos posted yet' : mediaType === 'video' ? 'No videos posted yet' : 'No media posted yet'} />
      ) : (
        <div className="media-gallery-grid">
          {assets.map((asset) => {
            if (asset.mediaType === 'video') return <VideoEmbedCard key={asset.id} asset={asset} />

            const articleHref = safeHttpsHref(asset.articleUrl)
            return (
              <article key={asset.id} className="gallery-card">
                {asset.imageUrl && <img src={asset.imageUrl} alt={asset.caption || asset.title} loading="lazy" />}
                <div>
                  <span>{asset.source}{asset.takenAt ? ` · ${formatGuamDate(asset.takenAt)}` : ''}</span>
                  <h2>{asset.title}</h2>
                  {asset.game && <small>{gameOptionLabel(asset.game)}</small>}
                  {asset.caption && <p>{asset.caption}</p>}
                  {articleHref && <a href={articleHref} target="_blank" rel="noreferrer">Source article <IconExternal /></a>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
