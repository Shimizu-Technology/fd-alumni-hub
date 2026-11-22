import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { formatGuamDateTime } from '../../lib/datetime'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref } from '../../lib/urls'
import { useMotionOk } from '../../hooks/useMotionOk'
import { HardwoodCourtMeter } from '../../components/HardwoodCourtMeter'
import { RevealOnScroll } from '../../components/RevealOnScroll'
import { EmptyState, LoadingState, Panel, SectionUnavailable, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconCalendar, IconExternal, IconTrophy } from '../../components/Icons'
import type { HafapassEventSummary, HafapassTicketState, PublicCampaignEvent } from '../../lib/types'

const currencyPrecise = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatTicketPrice(cents: number | null) {
  if (cents === null || cents === undefined) return null
  if (cents <= 0) return 'Free'
  return `From ${currencyPrecise.format(cents / 100)}`
}

type CountdownParts = {
  days: number
  hours: number
  minutes: number
  reached: boolean
}

function computeCountdown(targetIso?: string | null): CountdownParts | null {
  if (!targetIso) return null
  const targetMs = Date.parse(targetIso)
  if (!Number.isFinite(targetMs)) return null

  const diffMs = targetMs - Date.now()
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, reached: true }

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes, reached: false }
}

function eventKindLabel(kind: PublicCampaignEvent['kind']) {
  switch (kind) {
    case 'host_night':
      return 'Host night'
    case 'golf':
      return 'Golf tournament'
    case 'merch_drop':
      return 'Merch drop'
    case 'meeting':
      return 'Meeting'
    case 'other':
      return 'Community event'
    default:
      return 'Fundraiser'
  }
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

function isPastEvent(event: PublicCampaignEvent) {
  if (event.status === 'completed' || event.status === 'cancelled') return true
  const boundary = event.endsAt || event.startsAt
  if (!boundary) return false
  const parsed = Date.parse(boundary)
  return Number.isFinite(parsed) && parsed < Date.now()
}

function CampaignEventCard({ event, stale }: { event: PublicCampaignEvent; stale: boolean }) {
  const hp = event.hafapass || null
  const primaryHref = safeHttpsHref(hp?.buyUrl || event.externalUrl)
  const imageHref = safeHttpsHref(event.imageUrl)
  const effectiveState = hp && (!stale || hp.ticketState === 'cancelled') ? hp.ticketState : null
  const priceLabel = !stale && hp ? formatTicketPrice(hp.minAllInPriceCents) : null
  const ctaText = event.ctaLabel
    || (event.kind === 'golf'
      ? 'Register for Golf'
      : hp?.buyUrl
        ? (effectiveState === 'sold_out' ? 'View on HåfaPass' : 'Buy tickets')
        : 'Event details')

  return (
    <article className={`host-event-card panel ${event.kind === 'golf' ? 'host-event-card--golf' : ''}`}>
      {imageHref && (
        <div className="host-event-media">
          <img src={imageHref} alt="" loading="lazy" />
        </div>
      )}
      <div className="host-event-body">
        <div className="host-event-badges">
          <span className="division-pill">{eventKindLabel(event.kind)}</span>
          {effectiveState ? (
            <span className={`status-badge ${effectiveState === 'on_sale' ? 'live' : effectiveState === 'cancelled' || effectiveState === 'sold_out' ? 'cancelled' : 'upcoming'}`}>
              {ticketStateLabel(effectiveState)}
            </span>
          ) : (
            <StatusBadge status={event.status} />
          )}
          {priceLabel && <span className="host-price-pill">{priceLabel}</span>}
        </div>

        <h3>{event.title}</h3>
        <p className="host-event-meta">
          <IconCalendar size={15} />
          <span>{event.startsAt ? formatGuamDateTime(event.startsAt) : event.dateLabel || 'Date TBA'}</span>
          {event.venue && <span> · {event.venue}</span>}
        </p>

        {event.description && <p className="host-event-description">{event.description}</p>}
        {stale && hp && (
          <p className="muted-note">{hp.availabilityLabel || 'Check availability on HåfaPass'}</p>
        )}

        {primaryHref && (
          <div className="host-event-actions">
            <a className="btn primary small" href={primaryHref} target="_blank" rel="noreferrer">
              {ctaText} <IconExternal size={14} />
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

function UnmatchedHafapassCard({ event, stale }: { event: HafapassEventSummary; stale: boolean }) {
  const buyHref = safeHttpsHref(event.buyUrl)
  const priceLabel = !stale ? formatTicketPrice(event.minAllInPriceCents) : null
  const visibleState = !stale || event.ticketState === 'cancelled' ? event.ticketState : null

  return (
    <article className="host-event-card panel">
      <div className="host-event-body">
        <div className="host-event-badges">
          <span className="division-pill">{event.isPass ? 'Tournament pass' : 'HåfaPass event'}</span>
          {visibleState && (
            <span className={`status-badge ${visibleState === 'on_sale' ? 'live' : visibleState === 'cancelled' || visibleState === 'sold_out' ? 'cancelled' : 'upcoming'}`}>
              {ticketStateLabel(visibleState)}
            </span>
          )}
          {priceLabel && <span className="host-price-pill">{priceLabel}</span>}
        </div>
        <h3>{event.title}</h3>
        <p className="host-event-meta">
          <IconCalendar size={15} />
          <span>{event.startsAt ? formatGuamDateTime(event.startsAt) : 'Schedule on HåfaPass'}</span>
          {event.venueName && <span> · {event.venueName}</span>}
        </p>
        {event.shortDescription && <p className="host-event-description">{event.shortDescription}</p>}
        {stale && <p className="muted-note">{event.availabilityLabel || 'Check availability on HåfaPass'}</p>}
        {buyHref && (
          <div className="host-event-actions">
            <a className="btn secondary small" href={buyHref} target="_blank" rel="noreferrer">
              {visibleState === 'sold_out' ? 'View on HåfaPass' : 'Buy on HåfaPass'} <IconExternal size={14} />
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

export function HostYearPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const rawYear = searchParams.get('year')
  const yearParam = !slug && rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : undefined
  const queryKey = JSON.stringify({ slug: slug || '', year: yearParam ?? '' })
  const motionOk = useMotionOk()

  const { data: rawData, loading, error, errorStatus, reload } = useAsync(
    async () => ({
      queryKey,
      payload: await api.publicHostYear({ slug: slug || undefined, year: yearParam }),
    }),
    [queryKey],
  )

  const data = rawData?.queryKey === queryKey ? rawData.payload : null
  const countdownTarget = data?.campaign.countdownTargetAt || null
  const [countdown, setCountdown] = useState<CountdownParts | null>(() => computeCountdown(countdownTarget))

  useEffect(() => {
    const initial = computeCountdown(countdownTarget)
    setCountdown(initial)
    if (!countdownTarget || !initial || initial.reached) return undefined

    let timeoutId = 0
    const scheduleNext = () => {
      const targetMs = Date.parse(countdownTarget)
      if (!Number.isFinite(targetMs)) return
      const remainingMs = targetMs - Date.now()
      if (remainingMs <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, reached: true })
        return
      }
      const msToNextMinute = (remainingMs % 60_000) || 60_000
      timeoutId = window.setTimeout(() => {
        const next = computeCountdown(countdownTarget)
        setCountdown(next)
        if (next && !next.reached) scheduleNext()
      }, msToNextMinute + 50)
    }

    scheduleNext()
    return () => window.clearTimeout(timeoutId)
  }, [countdownTarget])

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const all = data?.events || []
    return {
      upcomingEvents: all.filter((event) => !isPastEvent(event)),
      pastEvents: all.filter((event) => isPastEvent(event)),
    }
  }, [data?.events])

  if (loading && !data) {
    return <LoadingState label="Loading host year hub" />
  }

  if (error && !data) {
    if (errorStatus === 404) {
      return (
        <div className="page-stack host-year-page">
          <section className="hero-card public-hero-card">
            <div className="hero-text">
              <p className="eyebrow">Host Year · FD Alumni Brotherhood</p>
              <h1>Host-year fundraisers, updates, and tournament countdown.</h1>
              <p>Each year’s host class shares upcoming fundraisers, ticket links, golf registration, and class announcements here.</p>
            </div>
          </section>
          <EmptyState
            title="Host year page not published yet"
            description="No active host-year campaign is published for this link yet. Browse tournament history or game-day info in the meantime."
            action={<Link className="btn secondary" to="/history">Browse champion history</Link>}
          />
        </div>
      )
    }

    return (
      <div className="page-stack host-year-page">
        <section className="hero-card public-hero-card">
          <div className="hero-text">
            <p className="eyebrow">Host Year · FD Alumni Brotherhood</p>
            <h1>Fundraisers, tickets, and class updates in one place.</h1>
            <p>Each host class organizes its fundraisers, golf tournament, sponsor updates, and tournament countdown from this hub.</p>
            <div className="hero-actions">
              <Link className="btn primary" to="/history"><IconTrophy /> Champion history</Link>
              <Link className="btn secondary" to="/info">Tournament info</Link>
            </div>
          </div>
        </section>
        <SectionUnavailable
          title="Host year details are temporarily unavailable"
          description="Live campaign fundraisers, countdown, and class announcements require the hub API."
          onRetry={reload}
          action={<Link className="btn secondary" to="/history">Browse offline champions</Link>}
        />
      </div>
    )
  }

  if (!data) return null

  const { campaign, posts, hafapass } = data
  const donateHref = safeHttpsHref(campaign.donationUrl)
  const golfHref = safeHttpsHref(campaign.golfUrl)
  const allTicketsHref = safeHttpsHref(hafapass.allTicketsUrl)
  const heroImageHref = safeHttpsHref(campaign.heroImageUrl)

  return (
    <div className="page-stack host-year-page">
      <section className={`hero-card public-hero-card host-hero-card ${motionOk ? 'hero-reveal' : ''}`}>
        <div className="hero-text">
          <p className="eyebrow">
            {campaign.hostClass ? `${campaign.hostClass.displayName} · ` : ''}
            {campaign.tournament ? `${campaign.tournament.year} Host Year` : 'Host Year'}
          </p>
          <h1>{campaign.title}</h1>
          {campaign.tagline && <p className="host-hero-tagline">{campaign.tagline}</p>}
          {campaign.description && <p>{campaign.description}</p>}

          <div className="hero-actions">
            {donateHref && (
              <a className="btn primary" href={donateHref} target="_blank" rel="noreferrer">
                Support &amp; Donate <IconExternal size={15} />
              </a>
            )}
            {allTicketsHref && (
              <a className={`btn ${donateHref ? 'secondary' : 'primary'}`} href={allTicketsHref} target="_blank" rel="noreferrer">
                Tickets on HåfaPass <IconExternal size={15} />
              </a>
            )}
            {golfHref && (
              <a className="btn secondary" href={golfHref} target="_blank" rel="noreferrer">
                Alumni Golf <IconExternal size={15} />
              </a>
            )}
            <Link className="btn secondary" to="/sponsors">
              Sponsors <IconArrowRight size={15} />
            </Link>
          </div>
        </div>

        <div className="hero-panel host-countdown-panel">
          {heroImageHref && (
            <img className="host-hero-thumb" src={heroImageHref} alt="" />
          )}
          <span>{campaign.countdownLabel || 'Countdown to tip-off'}</span>
          {countdown ? (
            countdown.reached ? (
              <strong>Tournament time!</strong>
            ) : (
              <div
                className="host-countdown-grid"
                role="group"
                aria-label={`Countdown: ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes`}
              >
                <div><strong>{countdown.days}</strong><small>Days</small></div>
                <div><strong>{countdown.hours}</strong><small>Hours</small></div>
                <div><strong>{countdown.minutes}</strong><small>Min</small></div>
              </div>
            )
          ) : (
            <strong>Dates TBA</strong>
          )}
          <div className="hero-panel-rule" aria-hidden="true" />
          <small>
            {golfHref
              ? 'Tickets sell on HåfaPass; golf registration runs on the Golf Platform. Everything routes from one front door.'
              : 'Tickets sell on HåfaPass. Fundraisers, sponsors, and tournament updates route from one front door.'}
          </small>
        </div>
      </section>

      {campaign.meter.enabled && <HardwoodCourtMeter key={campaign.id} meter={campaign.meter} />}

      {campaign.donationInstructions && (
        <Panel className="host-donate-panel">
          <div className="section-heading">
            <h2>Ways to support</h2>
            {donateHref && (
              <a className="btn secondary small" href={donateHref} target="_blank" rel="noreferrer">
                Give online <IconExternal size={14} />
              </a>
            )}
          </div>
          <div className="host-post-body">
            {campaign.donationInstructions.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </Panel>
      )}

      <section className="host-section">
        <div className="section-heading">
          <h2>Upcoming fundraisers &amp; events</h2>
          <span>{upcomingEvents.length} scheduled</span>
        </div>

        {upcomingEvents.length === 0 ? (
          <EmptyState
            title="Next fundraiser dates coming soon"
            description="Check back soon for upcoming host nights, golf registration, and tournament ticket drops."
          />
        ) : (
          <div className="host-events-grid">
            {upcomingEvents.map((event, index) => (
              <RevealOnScroll key={event.id} delayMs={Math.min(index * 55, 220)}>
                <CampaignEventCard event={event} stale={hafapass.stale} />
              </RevealOnScroll>
            ))}
          </div>
        )}
      </section>

      {hafapass.events.length > 0 && (
        <section className="host-section">
          <div className="section-heading">
            <h2>More tickets on HåfaPass</h2>
            {hafapass.stale && <span className="muted-note">Check availability on HåfaPass</span>}
          </div>
          <div className="host-events-grid">
            {hafapass.events.map((event) => (
              <UnmatchedHafapassCard key={event.id} event={event} stale={hafapass.stale} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="host-section">
          <div className="section-heading">
            <h2>Class updates &amp; recaps</h2>
            <span>{posts.length} posts</span>
          </div>
          <div className="host-posts-list">
            {posts.map((post) => {
              const postImageHref = safeHttpsHref(post.imageUrl)
              return (
                <RevealOnScroll key={post.id}>
                  <Panel className="host-post-card">
                    <div className="host-post-head">
                      <div>
                        {post.pinned && <span className="division-pill">Pinned</span>}
                        <h3>{post.title}</h3>
                      </div>
                      <small>
                        {post.publishedAt ? formatGuamDateTime(post.publishedAt) : ''}
                        {post.authorName ? ` · ${post.authorName}` : ''}
                      </small>
                    </div>
                    {postImageHref && (
                      <div className="host-post-media">
                        <img src={postImageHref} alt="" loading="lazy" />
                      </div>
                    )}
                    <div className="host-post-body">
                      {post.body.split(/\n{2,}/).map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </Panel>
                </RevealOnScroll>
              )
            })}
          </div>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="host-section">
          <div className="section-heading">
            <h2>Past fundraisers</h2>
            <span>{pastEvents.length} completed</span>
          </div>
          <div className="host-events-grid">
            {pastEvents.map((event) => (
              <CampaignEventCard key={event.id} event={event} stale={hafapass.stale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
