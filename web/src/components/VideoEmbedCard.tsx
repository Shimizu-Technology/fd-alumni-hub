import { useEffect, useRef, useState } from 'react'
import type { MediaAsset } from '../lib/types'
import { safeHttpsHref } from '../lib/urls'
import { IconExternal, IconPlay } from './Icons'
import { DivisionPill } from './ArchiveBadges'

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor(seconds / 60) % 60
  const remainder = String(seconds % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${String(minutes).padStart(2, '0')}:${remainder}`
}

export function VideoEmbedCard({ asset }: { asset: MediaAsset }) {
  const { externalVideoId, title, source, durationSeconds } = asset
  const youtubeId = asset.videoProvider === 'youtube' && externalVideoId?.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(externalVideoId)
    ? externalVideoId
    : null
  const [playingId, setPlayingId] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const playing = Boolean(youtubeId && playingId === youtubeId)

  useEffect(() => {
    if (playing) iframeRef.current?.focus()
  }, [playing])
  const thumbnail = safeHttpsHref(asset.imageUrl) || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null)
  const watchHref = safeHttpsHref(youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : asset.videoUrl)
  const duration = typeof durationSeconds === 'number' && Number.isInteger(durationSeconds) && durationSeconds >= 0 ? formatDuration(durationSeconds) : null

  return (
    <article className="video-card" id={`archive-video-${asset.id}`}>
      <div className="video-card-player">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={0}
            ref={iframeRef}
          />
        ) : (
          <>
            {thumbnail && <img src={thumbnail} alt="" loading="lazy" />}
            {youtubeId && <button type="button" className="video-card-play" aria-label={`Play ${title}`} onClick={() => setPlayingId(youtubeId)}><IconPlay size={23} /></button>}
            {duration && <span className="video-card-duration">{duration}</span>}
          </>
        )}
      </div>
      <div className="video-card-copy">
        <div className="video-card-meta"><span>{source}</span><DivisionPill division={asset.divisionSlug} /></div>
        <h3>{title}</h3>
        {watchHref && <a href={watchHref} target="_blank" rel="noreferrer">{asset.videoProvider === 'youtube' ? 'Watch on YouTube' : 'Watch video'} <IconExternal /></a>}
      </div>
    </article>
  )
}
