export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getHomeFeed } from '@/lib/services/public-feed'
import { QuickCard } from '@/components/quick-card'
import { LiveUpdates } from '@/components/live-updates'

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

export default async function Home() {
  const {
    tournament,
    upcomingOrLiveTournament,
    latestResultsTournament,
    todayGames,
    liveGames,
    latestNews,
  } = await getHomeFeed()

  const isLive = liveGames.length > 0

  return (
    <section className="space-y-6">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-2xl animate-fade-up"
        style={{
          background: 'linear-gradient(135deg, var(--fd-maroon-deeper) 0%, var(--fd-maroon-dark) 60%, var(--fd-maroon) 100%)',
          boxShadow: 'var(--shadow-maroon)',
          minHeight: '220px',
        }}
      >
        {/* Background pattern */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(217,178,111,0.12) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(255,255,255,0.04) 0%, transparent 40%)',
          }}
        />
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative px-6 py-8 md:px-10 md:py-10">
          {/* Status pill */}
          <div className="flex items-center gap-2 mb-4">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(224,36,62,0.2)', color: '#ff8097', border: '1px solid rgba(224,36,62,0.3)' }}>
                <span className="live-dot" style={{ background: '#ff8097', width: '6px', height: '6px' }} />
                LIVE NOW
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(217,178,111,0.15)', color: 'var(--fd-gold)', border: '1px solid rgba(217,178,111,0.25)' }}>
                Official Tournament Hub
              </span>
            )}
          </div>

          {/* Heading */}
          <h1
            className="text-4xl font-bold leading-tight md:text-5xl lg:text-[52px] animate-fade-up delay-75"
            style={{ color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            FD Alumni
            <br />
            <span style={{ color: 'var(--fd-gold)' }}>Basketball</span>
          </h1>

          {/* Description */}
          <p
            className="mt-3 max-w-lg text-sm leading-relaxed md:text-base animate-fade-up delay-150"
            style={{ color: 'rgba(240,232,236,0.7)' }}
          >
            {tournament
              ? `${tournament.name} ${tournament.year} — schedule, standings, watch links, and verified updates.`
              : 'Single source of truth for schedule, standings, watch links, and tournament updates.'}
          </p>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3 animate-fade-up delay-225">
            <Link
              href="/schedule"
              className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon-deeper)', boxShadow: '0 2px 12px rgba(217,178,111,0.3)' }}
            >
              <CalendarIcon />
              View Schedule
              <span className="transition-transform duration-200 group-hover:translate-x-0.5"><ArrowRightIcon /></span>
            </Link>
            <Link
              href="/standings"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
            >
              <TrophyIcon />
              Standings
            </Link>
            <Link
              href="/watch"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(240,232,236,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <PlayIcon />
              Watch
            </Link>
          </div>

          {/* Tournament status strip */}
          <div
            className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 text-xs animate-fade-up delay-300"
            style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span style={{ color: 'rgba(240,232,236,0.5)' }}>
              Active:{' '}
              <span className="font-semibold" style={{ color: 'rgba(240,232,236,0.85)' }}>
                {upcomingOrLiveTournament
                  ? `${upcomingOrLiveTournament.year} ${upcomingOrLiveTournament.status.toUpperCase()}`
                  : 'None'}
              </span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span style={{ color: 'rgba(240,232,236,0.5)' }}>
              Latest:{' '}
              <span className="font-semibold" style={{ color: 'rgba(240,232,236,0.85)' }}>
                {latestResultsTournament
                  ? `${latestResultsTournament.year} COMPLETED`
                  : 'No data yet'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard
          title="Games Today"
          value={String(todayGames.length)}
          accent="maroon"
        />
        <QuickCard
          title="Live Now"
          value={String(liveGames.length)}
          accent={liveGames.length > 0 ? 'live' : 'neutral'}
          sub={liveGames.length > 0 ? 'Game in progress' : 'No active games'}
        />
        <QuickCard
          title="News Items"
          value={String(latestNews.length)}
          accent="gold"
        />
        <QuickCard
          title="Tournament"
          value={tournament ? tournament.status.toUpperCase() : '—'}
          sub={tournament ? tournament.name : 'No active tournament'}
          accent="neutral"
        />
      </div>

      {/* ── Latest updates ────────────────────────────────────── */}
      <LiveUpdates items={latestNews as any} />

    </section>
  )
}
