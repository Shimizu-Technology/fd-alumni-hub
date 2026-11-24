import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FundraiserBadges, FundraiserDate, FundraiserTicketAction, isClosedFundraiser } from '../../components/CampaignEventCard'
import { EmptyState, LoadingState, Panel, SectionUnavailable } from '../../components/ui'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { RecapPhoto } from '../../lib/types'
import { safeHttpsHref } from '../../lib/urls'

function RecapGallery({ photos }: { photos: RecapPhoto[] }) {
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement>(null)

  const open = (event: MouseEvent<HTMLButtonElement>, photoIndex: number) => {
    opener.current = event.currentTarget
    setIndex(photoIndex)
    dialog.current?.showModal()
    closeButton.current?.focus()
  }

  const close = () => {
    dialog.current?.close()
    opener.current?.focus()
  }

  const move = (offset: number) => setIndex((current) => (current + offset + photos.length) % photos.length)
  const handleKeys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  const photo = photos[index]
  return (
    <section>
      <h3>Recap Photo Gallery</h3>
      <div className="fundraiser-photo-grid">
        {photos.map((item, photoIndex) => (
          <figure key={`${item.url}-${photoIndex}`}>
            <button type="button" className="fundraiser-photo-button" onClick={(event) => open(event, photoIndex)}
              aria-label={`Open recap photo ${photoIndex + 1}${item.caption ? `, ${item.caption}` : ''}`}>
              <img src={item.url} alt="" loading="lazy" />
            </button>
            {item.caption && <figcaption>{item.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <dialog ref={dialog} className="recap-lightbox" aria-modal="true" aria-label="Recap Photo Gallery"
        onClick={(event) => { if (event.target === event.currentTarget) close() }}
        onKeyDown={handleKeys} onCancel={(event) => { event.preventDefault(); close() }}>
        <div className="recap-lightbox-toolbar">
          <span aria-live="polite">{index + 1} of {photos.length}</span>
          <button type="button" className="btn secondary small" ref={closeButton} onClick={close}>Close</button>
        </div>
        <figure>
          <img src={photo.url} alt={photo.caption ? '' : `Recap photo ${index + 1}`} />
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
        {photos.length > 1 && (
          <div className="recap-lightbox-toolbar">
            <button type="button" className="btn secondary small" onClick={() => move(-1)}>Previous</button>
            <button type="button" className="btn secondary small" onClick={() => move(1)}>Next</button>
          </div>
        )}
      </dialog>
    </section>
  )
}

export function FundraiserDetailPage() {
  const { id = '' } = useParams()
  return <FundraiserDetail key={id} id={id} />
}

function FundraiserDetail({ id }: { id: string }) {
  const { siteMode } = useSiteMode()
  const { data, loading, error, errorStatus, reload } = useAsync(() => api.publicFundraiser(id), [id])
  const onFundraisingHome = siteMode.mode === 'fundraising'
  const campaignBackTo = data?.campaign.slug
    ? `/host-year/${encodeURIComponent(data.campaign.slug)}`
    : (onFundraisingHome ? '/' : '/host-year')
  const back = <Link className="fundraiser-back" to={campaignBackTo}>← Back to fundraisers</Link>

  if (loading && !data) return <LoadingState label="Loading fundraiser" />
  if (error || !data) {
    return (
      <div className="page-stack">
        {back}
        {errorStatus === 404
          ? <EmptyState title="Fundraiser not found" description="This event is unavailable." />
          : <SectionUnavailable title="Fundraiser details are temporarily unavailable" description="Try loading this fundraiser again." onRetry={reload} />}
      </div>
    )
  }

  const { event, campaign } = data
  const cover = safeHttpsHref(event.imageUrl)
  const photos = (event.recapPhotos || []).flatMap((photo) => {
    const url = safeHttpsHref(photo.url)
    return url ? [{ ...photo, url }] : []
  })
  const showRecap = event.status === 'completed' || event.recapNotes || event.recapHighlights || event.raisedDisplay || photos.length > 0

  return (
    <div className="page-stack fundraiser-detail">
      {back}
      <Panel className="fundraiser-detail-header">
        <div className="fundraiser-detail-content">
          <p className="eyebrow">{campaign.hostClass?.displayName || campaign.title}</p>
          <FundraiserBadges event={event} />
          <h1>{event.title}</h1>
          <FundraiserDate event={event} showEnd />
          {event.description && <p className="fundraiser-copy">{event.description}</p>}
          {event.hafapass?.stale && !isClosedFundraiser(event) && <p className="muted-note">{event.hafapass.availabilityLabel}</p>}
          <div className="row-actions"><FundraiserTicketAction event={event} /></div>
        </div>
        {cover && <img className="fundraiser-cover" src={cover} alt={`Flyer for ${event.title}`} />}
      </Panel>
      {showRecap && (
        <Panel className="fundraiser-recap">
          <div className="section-heading">
            <h2>Event Recap</h2>
            {event.raisedDisplay && <span className="host-price-pill">{event.raisedDisplay}</span>}
          </div>
          {event.recapNotes && <p className="fundraiser-copy">{event.recapNotes}</p>}
          {event.recapHighlights && (
            <div><h3>Highlights</h3><p className="fundraiser-copy">{event.recapHighlights}</p></div>
          )}
          {photos.length > 0 && <RecapGallery photos={photos} />}
        </Panel>
      )}
    </div>
  )
}
