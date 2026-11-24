import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref } from '../../lib/urls'
import type { HafapassEventSummary, HafapassTicketState, PublicTicketFundraiserItem, TicketsDoorInfo } from '../../lib/types'
import { useSiteMode } from '../../contexts/SiteModeContext'
import { LoadingState, PageHeader, Panel, SectionUnavailable, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconExternal, IconTicket } from '../../components/Icons'

const currencyPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const FALLBACK_DOOR_INFO: TicketsDoorInfo = {
  venue: 'Father Duenas Phoenix Center (Mangilao, Guam)',
  doorsOpenNote: 'Check the schedule and Today at The Jungle for nightly tip-off times and door-opening updates.',
  paymentNote: 'Advance digital tickets and tournament passes are sold online through HåfaPass. Check HåfaPass event listings or game-day notes for door admission details.',
  reentryNote: 'Keep your digital HåfaPass ticket ready at the entrance and follow FDAA staff guidance for re-entry.',
  tournamentYear: null,
}

function formatTicketPrice(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null
  if (cents <= 0) return 'Free'
  return `From ${currencyPrecise.format(cents / 100)}`
}

function ticketStateLabel(state: HafapassTicketState) {
  switch (state) {
    case 'on_sale':
      return 'Tickets on sale'
    case 'sold_out':
      return 'Sold out'
    case 'upcoming':
      return 'Tickets soon'
    case 'sales_ended':
      return 'Sales ended'
    case 'cancelled':
      return 'Cancelled'
  }
}

function ticketBadgeClass(state: HafapassTicketState) {
  if (state === 'on_sale') return 'live'
  if (state === 'cancelled' || state === 'sold_out') return 'cancelled'
  return 'upcoming'
}

const MAX_COLD_SNAPSHOT_RETRIES = 2
const COLD_SNAPSHOT_RETRY_DELAY_MS = 2_500

export function TicketsPage() {
  const { siteMode } = useSiteMode()
  const [searchParams] = useSearchParams()
  const campaignSlug = searchParams.get('campaignSlug')
  const rawYear = searchParams.get('year')
  const year = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null
  const queryKey = JSON.stringify({ campaignSlug, year })
  const retryCountRef = useRef(0)

  const { data: rawData, loading, error, reload } = useAsync(
    async () => ({
      queryKey,
      payload: await api.publicTickets({ campaignSlug, year }),
    }),
    [queryKey],
  )

  const data = rawData?.queryKey === queryKey ? rawData.payload : null
  const allTicketsHref = safeHttpsHref(data?.campaign?.allTicketsUrl)
  const passes = data?.passes || []
  const gameNights = data?.gameNights || []
  const otherEvents = data?.otherEvents || []
  const rawFundraiserEvents = data?.fundraiserEvents || []
  const fundraiserEvents = [...rawFundraiserEvents].sort((a, b) => {
    const aClosed = a.status === 'completed' || a.status === 'cancelled' ? 1 : 0
    const bClosed = b.status === 'completed' || b.status === 'cancelled' ? 1 : 0
    return aClosed - bClosed
  })
  const hasTournamentListings = passes.length > 0 || gameNights.length > 0 || otherEvents.length > 0
  const isFundraisingOnly = siteMode.mode === 'fundraising' && !hasTournamentListings
  const stale = Boolean(data?.hafapass.stale)
  const doorInfo = data?.doorInfo || FALLBACK_DOOR_INFO
  const hasAnyListings = hasTournamentListings || fundraiserEvents.length > 0

  useEffect(() => {
    retryCountRef.current = 0
  }, [queryKey])

  useEffect(() => {
    if (loading || error || !data || hasAnyListings || !data.campaign || data.hafapass.available) return
    if (retryCountRef.current >= MAX_COLD_SNAPSHOT_RETRIES) return

    const timer = window.setTimeout(() => {
      retryCountRef.current += 1
      void reload()
    }, COLD_SNAPSHOT_RETRY_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [loading, error, data, hasAnyListings, reload, queryKey])

  return (
    <div className="page-stack tickets-page">
      <PageHeader
        eyebrow="Tickets & Passes"
        title={isFundraisingOnly && data
          ? `${data.tournament ? `${data.tournament.year} ` : ''}Fundraisers & Tournament Tickets`
          : data?.tournament ? `${data.tournament.year} Tournament Tickets` : 'Tournament Tickets'}
        description={isFundraisingOnly && data
          ? `Host-class fundraiser events are underway now. Official ${data.tournament ? `${data.tournament.year} ` : ''}tournament passes and single-night Phoenix Center tickets will post here via HåfaPass closer to tip-off.`
          : 'Official tournament passes, single-night Phoenix Center tickets, and host-class fundraiser events powered by HåfaPass.'}
        actions={
          allTicketsHref ? (
            <a className="btn primary" href={allTicketsHref} target="_blank" rel="noreferrer">
              <IconTicket size={16} /> Buy on HåfaPass <IconExternal size={14} />
            </a>
          ) : isFundraisingOnly ? (
            <Link className="btn secondary" to="/">
              Back to Host Year <IconArrowRight size={15} />
            </Link>
          ) : (
            <Link className="btn secondary" to="/schedule">
              View schedule <IconArrowRight size={15} />
            </Link>
          )
        }
      />

      {loading && !data ? (
        <LoadingState label="Loading tournament tickets" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Live ticket listings are temporarily unavailable"
          description="HåfaPass and live tournament listings could not be reached right now. Door and admission information remains available below."
          onRetry={reload}
        />
      ) : !hasAnyListings ? (
        <Panel className="tickets-empty-panel">
          <h2>Ticket sales will appear here when posted</h2>
          <p>
            Official passes and game-night tickets will list automatically as soon as they are published on HåfaPass.
            {data?.campaign && (
              <>
                {' '}You can also follow host-year announcements on{' '}
                <Link to={`/host-year/${data.campaign.slug}`}>{data.campaign.title}</Link>.
              </>
            )}
          </p>
          {allTicketsHref && (
            <div className="ticket-card-actions">
              <a className="btn primary" href={allTicketsHref} target="_blank" rel="noreferrer">
                Browse HåfaPass storefront <IconExternal size={14} />
              </a>
            </div>
          )}
        </Panel>
      ) : (
        <>
          {stale && (
            <div className="panel tickets-stale-banner" role="status">
              <strong>Live pricing and inventory are refreshing.</strong>
              <span>Use each direct HåfaPass link below to check live ticket availability and all-in pricing.</span>
            </div>
          )}

          {passes.length > 0 && (
            <section className="page-section" aria-labelledby="tickets-passes-heading">
              <div className="section-heading">
                <h2 id="tickets-passes-heading">Tournament passes</h2>
                <span>Best value for multiple game nights</span>
              </div>
              <div className="ticket-grid ticket-grid--passes">
                {passes.map((event) => (
                  <HafapassTicketCard
                    key={event.id}
                    event={event}
                    stale={stale}
                    isPass
                    fallbackHref={allTicketsHref}
                  />
                ))}
              </div>
            </section>
          )}

          {gameNights.length > 0 && (
            <section className="page-section" aria-labelledby="tickets-nights-heading">
              <div className="section-heading">
                <h2 id="tickets-nights-heading">Game night tickets</h2>
                <span>{gameNights.length} {gameNights.length === 1 ? 'night' : 'nights'} listed</span>
              </div>
              <div className="ticket-grid">
                {gameNights.map((event) => (
                  <HafapassTicketCard
                    key={event.id}
                    event={event}
                    stale={stale}
                    fallbackHref={allTicketsHref}
                  />
                ))}
              </div>
            </section>
          )}

          {otherEvents.length > 0 && (
            <section className="page-section" aria-labelledby="tickets-other-heading">
              <div className="section-heading">
                <h2 id="tickets-other-heading">Tournament events & registration</h2>
              </div>
              <div className="ticket-grid">
                {otherEvents.map((event) => (
                  <HafapassTicketCard
                    key={event.id}
                    event={event}
                    stale={stale}
                    categoryLabel="Tournament event"
                    fallbackHref={allTicketsHref}
                  />
                ))}
              </div>
            </section>
          )}

          {fundraiserEvents.length > 0 && (
            <section className="page-section" aria-labelledby="tickets-fundraisers-heading">
              <div className="section-heading">
                <h2 id="tickets-fundraisers-heading">Host class fundraisers & community events</h2>
                {data?.campaign && (
                  <Link className="btn secondary small" to={`/host-year/${data.campaign.slug}`}>
                    Host Year hub <IconArrowRight size={14} />
                  </Link>
                )}
              </div>
              <div className="ticket-grid">
                {fundraiserEvents.map((item) => (
                  <FundraiserTicketCard key={item.id} item={item} fallbackHref={allTicketsHref} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="panel door-info-panel" aria-labelledby="door-info-heading">
        <div className="section-heading">
          <h2 id="door-info-heading">Door & admission info</h2>
          <span>Phoenix Center game-night guide</span>
        </div>
        <div className="door-info-grid">
          <div>
            <strong>Venue</strong>
            <p>{doorInfo.venue}</p>
          </div>
          <div>
            <strong>Doors & entry</strong>
            <p>{doorInfo.doorsOpenNote}</p>
          </div>
          <div>
            <strong>Digital & walk-up tickets</strong>
            <p>{doorInfo.paymentNote}</p>
          </div>
          <div>
            <strong>Re-entry</strong>
            <p>{doorInfo.reentryNote}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function HafapassTicketCard({
  event,
  stale,
  isPass = false,
  categoryLabel,
  fallbackHref,
}: {
  event: HafapassEventSummary
  stale: boolean
  isPass?: boolean
  categoryLabel?: string
  fallbackHref: string | null
}) {
  const buyHref = safeHttpsHref(event.buyUrl) || fallbackHref
  const itemStale = event.stale ?? stale
  const visibleState = !itemStale || event.ticketState === 'cancelled' ? event.ticketState : null
  const priceLabel = !itemStale ? formatTicketPrice(event.minAllInPriceCents) : null
  const badgeText = categoryLabel || (isPass ? 'Tournament pass' : 'Game night')

  return (
    <article className={`panel ticket-card${isPass ? ' ticket-card--pass' : ''}`}>
      <div className="ticket-card-badges">
        <span className="division-pill">{badgeText}</span>
        {itemStale && visibleState !== 'cancelled' ? (
          <span className="status-badge upcoming">Check live availability on HåfaPass</span>
        ) : visibleState ? (
          <span className={`status-badge ${ticketBadgeClass(visibleState)}`}>
            {ticketStateLabel(visibleState)}
          </span>
        ) : null}
        {priceLabel && <span className="host-price-pill">{priceLabel}</span>}
      </div>

      <h3>{event.title}</h3>
      <p className="ticket-card-meta">
        <IconCalendar size={15} />
        <span>{event.startsAt ? formatGuamDateTime(event.startsAt) : 'Schedule on HåfaPass'}</span>
        {event.venueName && <span> · {event.venueName}</span>}
      </p>

      {event.shortDescription && <p className="ticket-card-description">{event.shortDescription}</p>}

      {buyHref && (
        <div className="ticket-card-actions">
          <a
            className={`btn ${isPass ? 'primary' : 'secondary'} small`}
            href={buyHref}
            target="_blank"
            rel="noreferrer"
          >
            {visibleState === 'sold_out' ? 'View on HåfaPass' : isPass ? 'Get pass' : 'Buy tickets'} <IconExternal size={14} />
          </a>
        </div>
      )}
    </article>
  )
}

function FundraiserTicketCard({
  item,
  fallbackHref,
}: {
  item: PublicTicketFundraiserItem
  fallbackHref: string | null
}) {
  const closed = item.status === 'completed' || item.status === 'cancelled'
  const buyHref = closed || item.ticketState === 'cancelled' ? null : safeHttpsHref(item.buyUrl) || fallbackHref
  const visibleState = !item.stale || item.ticketState === 'cancelled' ? item.ticketState : null
  const priceLabel = !closed && !item.stale ? formatTicketPrice(item.minAllInPriceCents) : null

  return (
    <article className="panel ticket-card">
      <div className="ticket-card-badges">
        <span className="division-pill">{item.kind === 'golf' ? 'Golf tournament' : 'Host fundraiser'}</span>
        {closed ? (
          <StatusBadge status={item.status} />
        ) : item.stale && visibleState !== 'cancelled' ? (
          <span className="status-badge upcoming">Check live availability on HåfaPass</span>
        ) : visibleState ? (
          <span className={`status-badge ${ticketBadgeClass(visibleState)}`}>
            {ticketStateLabel(visibleState)}
          </span>
        ) : (
          <StatusBadge status={item.status} />
        )}
        {priceLabel && <span className="host-price-pill">{priceLabel}</span>}
      </div>

      <h3>{item.title}</h3>
      <p className="ticket-card-meta">
        <IconCalendar size={15} />
        <span>{item.startsAt ? formatGuamDateTime(item.startsAt) : item.dateLabel || 'Date TBA'}</span>
        {item.venueName && <span> · {item.venueName}</span>}
      </p>

      {item.shortDescription && <p className="ticket-card-description">{item.shortDescription}</p>}

      {(buyHref || !item.id.startsWith('hp-')) && (
        <div className="ticket-card-actions">
          {buyHref && (
            <a className="btn primary small" href={buyHref} target="_blank" rel="noreferrer">
              {item.ctaLabel || 'Buy tickets'} <IconExternal size={14} />
            </a>
          )}
          {!item.id.startsWith('hp-') && (
            <Link className="btn secondary small" to={`/fundraisers/${item.id}`}>
              {closed ? 'View recap' : 'Event details'} <IconArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
    </article>
  )
}
