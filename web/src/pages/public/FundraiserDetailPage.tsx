import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FundraiserBadges, FundraiserDate, FundraiserTicketAction, isClosedFundraiser } from '../../components/CampaignEventCard'
import { SITE_NAME } from '../../components/SeoManager'
import { EmptyState, LoadingState, Panel, SectionUnavailable } from '../../components/ui'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { PhotoGallery } from '../../components/PhotoGallery'
import { safeHttpsHref } from '../../lib/urls'

export function FundraiserDetailPage() {
  const { id = '' } = useParams()
  return <FundraiserDetail key={id} id={id} />
}

function FundraiserDetail({ id }: { id: string }) {
  const { siteMode } = useSiteMode()
  const { data, loading, error, errorStatus, reload } = useAsync(() => api.publicFundraiser(id), [id])
  const eventTitle = data?.event.title

  useEffect(() => {
    if (!eventTitle) return
    const nextTitle = `${eventTitle} | ${SITE_NAME}`
    document.title = nextTitle
    for (const selector of ['meta[name="title"]', 'meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', nextTitle)
    }
  }, [eventTitle])
  const onFundraisingHome = siteMode.mode === 'fundraising'
  const isDefaultActiveCampaign = Boolean(
    data?.campaign.slug &&
    data.campaign.status !== 'archived' &&
    (!siteMode.hostCampaign?.slug || siteMode.hostCampaign.slug === data.campaign.slug),
  )
  const campaignBackTo = onFundraisingHome && isDefaultActiveCampaign
    ? '/'
    : data?.campaign.slug
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
          {photos.length > 0 && <PhotoGallery photos={photos} title="Recap Photo Gallery" photoLabel="recap photo" />}
        </Panel>
      )}
    </div>
  )
}
