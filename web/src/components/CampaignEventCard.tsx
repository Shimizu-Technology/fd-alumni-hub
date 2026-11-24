import { Link } from 'react-router-dom'
import { formatGuamDateTime } from '../lib/datetime'
import { safeHttpsHref } from '../lib/urls'
import type { HafapassTicketState, PublicCampaignEvent } from '../lib/types'
import { IconArrowRight, IconCalendar, IconExternal } from './Icons'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 })
const eventKinds: Record<PublicCampaignEvent['kind'], string> = {
  fundraiser: 'Fundraiser', host_night: 'Host night', golf: 'Golf tournament',
  merch_drop: 'Merch drop', meeting: 'Meeting', other: 'Community event',
}
const ticketLabels: Record<HafapassTicketState, string> = {
  on_sale: 'Tickets on sale', sold_out: 'Sold out', upcoming: 'Tickets soon',
  sales_ended: 'Sales ended', cancelled: 'Cancelled',
}

export function ticketStateLabel(state: HafapassTicketState) {
  return ticketLabels[state]
}

export function formatTicketPrice(cents: number | null) {
  if (cents == null) return null
  return cents <= 0 ? 'Free' : `From ${currency.format(cents / 100)}`
}

export function isClosedFundraiser(event: PublicCampaignEvent) {
  return event.status === 'completed' || event.status === 'cancelled'
}

export function FundraiserBadges({ event }: { event: PublicCampaignEvent }) {
  const hp = event.hafapass
  const ticketState = hp?.ticketState
  const completed = event.status === 'completed'
  const cancelled = event.status === 'cancelled' || ticketState === 'cancelled'
  const label = completed ? 'Completed'
    : cancelled ? 'Cancelled'
    : ticketState === 'on_sale' ? 'Tickets on sale'
    : event.status === 'sold_out' || ticketState === 'sold_out' ? 'Sold out'
    : 'Upcoming'
  const tone = completed ? 'status-completed' : cancelled ? 'cancelled' : ticketState === 'on_sale' ? 'live' : 'upcoming'
  const price = !completed && !cancelled && hp && !hp.stale ? formatTicketPrice(hp.minAllInPriceCents) : null

  return (
    <div className="host-event-badges">
      <span className="division-pill">{eventKinds[event.kind]}</span>
      <span className={`status-badge ${tone}`}>{label}</span>
      {price && <span className="host-price-pill">{price}</span>}
    </div>
  )
}

export function FundraiserDate({ event, showEnd = false }: { event: PublicCampaignEvent; showEnd?: boolean }) {
  const start = event.startsAt || event.hafapass?.startsAt
  const end = event.endsAt || event.hafapass?.endsAt
  const venue = event.venue || event.hafapass?.venueName
  return (
    <p className="host-event-meta">
      <IconCalendar size={15} />
      <span>{start ? formatGuamDateTime(start) : event.dateLabel || 'Date TBA'}</span>
      {showEnd && end && end !== start && <span>– {formatGuamDateTime(end)}</span>}
      {venue && <span>· {venue}</span>}
    </p>
  )
}

export function FundraiserTicketAction({ event }: { event: PublicCampaignEvent }) {
  if (isClosedFundraiser(event) || event.hafapass?.ticketState === 'cancelled') return null
  const hp = event.hafapass
  const href = safeHttpsHref(hp?.buyUrl) || safeHttpsHref(event.externalUrl)
  if (!href) return null

  const label = event.ctaLabel || (event.kind === 'golf' ? 'Register for Golf'
    : hp?.buyUrl ? (hp.ticketState === 'sold_out' || hp.ticketState === 'sales_ended' || hp.stale ? 'View on HåfaPass' : 'Buy tickets')
    : 'Visit event website')

  return <a className="btn primary small" href={href} target="_blank" rel="noreferrer">{label} <IconExternal size={14} /></a>
}

export function CampaignEventCard({ event }: { event: PublicCampaignEvent }) {
  const detailHref = `/fundraisers/${encodeURIComponent(event.id)}`
  const completed = event.status === 'completed'
  const imageHref = safeHttpsHref(event.imageUrl) || (completed ? safeHttpsHref(event.recapPhotos?.[0]?.url) : null)

  return (
    <article className={`host-event-card panel ${event.kind === 'golf' ? 'host-event-card--golf' : ''}`}>
      {imageHref && (
        <Link to={detailHref} className="host-event-media" aria-label={event.title}>
          <img src={imageHref} alt="" loading="lazy" />
        </Link>
      )}
      <div className="host-event-body">
        <FundraiserBadges event={event} />
        <h3><Link to={detailHref}>{event.title}</Link></h3>
        <FundraiserDate event={event} />
        {completed && event.raisedDisplay && <span className="host-price-pill fundraiser-raised">{event.raisedDisplay}</span>}
        {event.description && <p className="host-event-description fundraiser-card-description">{event.description}</p>}
        {!isClosedFundraiser(event) && event.hafapass?.stale && <p className="muted-note">{event.hafapass.availabilityLabel}</p>}
        <div className="host-event-actions row-actions">
          <Link className="btn secondary small" to={detailHref}>
            {completed ? 'View recap & photos' : 'Event details'} <IconArrowRight size={14} />
          </Link>
          <FundraiserTicketAction event={event} />
        </div>
      </div>
    </article>
  )
}
