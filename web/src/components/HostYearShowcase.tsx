import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatGuamDateTime } from '../lib/datetime'
import { safeHttpsHref } from '../lib/urls'
import { useMotionOk } from '../hooks/useMotionOk'
import { HardwoodCourtMeter } from './HardwoodCourtMeter'
import { RevealOnScroll } from './RevealOnScroll'
import { EmptyState, Panel } from './ui'
import { IconArrowRight, IconCalendar, IconExternal } from './Icons'
import { CampaignEventCard, formatTicketPrice, isClosedFundraiser, ticketStateLabel } from './CampaignEventCard'
import type { HafapassEventSummary, HostYearResponse } from '../lib/types'

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

export function HostYearShowcase({ data }: { data: HostYearResponse }) {
  const motionOk = useMotionOk()
  const { campaign, posts, hafapass } = data
  const countdownTarget = campaign.countdownTargetAt
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

  const upcomingEvents = data.events.filter((event) => !isClosedFundraiser(event))
  const pastEvents = data.events.filter(isClosedFundraiser).reverse()
  const shownEventImages = new Set(
    data.events
      .map((event) => safeHttpsHref(event.imageUrl) || (event.status === 'completed' ? safeHttpsHref(event.recapPhotos?.[0]?.url) : null))
      .filter((href): href is string => Boolean(href)),
  )

  const donateHref = safeHttpsHref(campaign.donationUrl)
  const golfHref = safeHttpsHref(campaign.golfUrl)
  const allTicketsHref = safeHttpsHref(hafapass.allTicketsUrl)
  const heroImageHref = safeHttpsHref(campaign.heroImageUrl)

  return (
    <div className="page-stack host-year-page">
      <div className={campaign.meter.enabled ? 'host-arena-hero-grid' : 'host-arena-hero-single'}>
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
                <a className="btn primary" href={golfHref} target="_blank" rel="noreferrer">
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
          </div>
        </section>

        {campaign.meter.enabled && <HardwoodCourtMeter key={campaign.id} meter={campaign.meter} />}
      </div>

      {pastEvents.length > 0 && (
        <section className="host-section">
          <div className="section-heading">
            <h2>Completed &amp; past fundraisers</h2>
          </div>
          <div className={`host-events-grid ${pastEvents.length === 1 ? 'host-events-grid--spotlight' : 'host-events-grid--two'}`}>
            {pastEvents.map((event) => (
              <CampaignEventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      <section className="host-section">
        <div className="section-heading">
          <h2>Upcoming fundraisers &amp; events</h2>
          <span>{upcomingEvents.length} scheduled</span>
        </div>

        {upcomingEvents.length === 0 ? (
          <EmptyState
            title="Next fundraiser dates coming soon"
            description="Check back soon for upcoming host nights and golf registration."
          />
        ) : (
          <div className="host-events-grid host-events-grid--two">
            {upcomingEvents.map((event, index) => (
              <RevealOnScroll key={event.id} delayMs={Math.min(index * 55, 220)}>
                <CampaignEventCard event={event} />
              </RevealOnScroll>
            ))}
          </div>
        )}
      </section>
      {(campaign.donationInstructions || donateHref) && (
        <Panel className="host-donate-panel">
          <div className="section-heading"><h2>Ways to donate &amp; sponsor</h2></div>
          {campaign.donationInstructions && <p className="fundraiser-copy">{campaign.donationInstructions}</p>}
          <div className="hero-actions">
            {donateHref && <a className="btn primary small" href={donateHref} target="_blank" rel="noreferrer">Give online <IconExternal size={14} /></a>}
            <Link className="btn secondary small" to="/sponsors">Explore sponsorship <IconArrowRight size={14} /></Link>
          </div>
        </Panel>
      )}

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
              const showPostImage = Boolean(postImageHref && !shownEventImages.has(postImageHref))
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
                    {showPostImage && postImageHref && (
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

    </div>
  )
}
