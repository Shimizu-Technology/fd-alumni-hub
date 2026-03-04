export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'

export const metadata: Metadata = {
  title: 'Schedule',
}

type ScheduleGame = {
  id: string
  startTime: Date
  venue: string | null
  status: 'scheduled' | 'live' | 'final'
  homeScore: number | null
  awayScore: number | null
  streamUrl: string | null
  ticketUrl: string | null
  homeTeam: { displayName: string }
  awayTeam: { displayName: string }
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function dayKeyShort(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: 'scheduled' | 'live' | 'final' }) {
  if (status === 'live') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider badge-live"
      >
        <span className="live-dot" style={{ width: '5px', height: '5px', flexShrink: 0 }} />
        Live
      </span>
    )
  }
  if (status === 'final') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-final">
        Final
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-upcoming">
      Upcoming
    </span>
  )
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

function GameRow({ game }: { game: ScheduleGame }) {
  const isLive = game.status === 'live'
  const isFinal = game.status === 'final'
  const hasScore = isFinal && game.homeScore != null && game.awayScore != null

  return (
    <div
      className="group relative px-5 py-4 transition-colors duration-150 hover:bg-neutral-50"
      style={{
        borderLeft: isLive ? '3px solid var(--status-live)' : '3px solid transparent',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">

        {/* Time + venue */}
        <div className="shrink-0 w-28">
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--neutral-700)' }}>
            {new Date(game.startTime).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
          {game.venue && (
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--neutral-400)' }}>
              {game.venue}
            </p>
          )}
        </div>

        {/* Matchup */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-sm" style={{ color: 'var(--fd-ink)' }}>
              {game.awayTeam.displayName}
            </span>
            <span className="text-xs font-medium" style={{ color: 'var(--neutral-400)' }}>vs</span>
            <span className="font-semibold text-sm" style={{ color: 'var(--fd-ink)' }}>
              {game.homeTeam.displayName}
            </span>
          </div>
          {hasScore && (
            <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--fd-maroon)' }}>
              {game.awayScore} &ndash; {game.homeScore}
            </p>
          )}
        </div>

        {/* Status + actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge status={game.status} />
          {game.streamUrl && (
            <Link
              href={game.streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm"
              style={{ background: 'var(--fd-maroon)', color: '#fff' }}
            >
              Watch <ExternalIcon />
            </Link>
          )}
          {game.ticketUrl && (
            <Link
              href={game.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 hover:-translate-y-0.5"
              style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}
            >
              Tickets <ExternalIcon />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function SchedulePage() {
  const { tournament, games } = await getSchedule()
  const typedGames = games as ScheduleGame[]

  const grouped: Record<string, ScheduleGame[]> = {}
  for (const game of typedGames) {
    const key = dayKey(new Date(game.startTime))
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(game)
  }
  const days = Object.entries(grouped)

  const liveCount = typedGames.filter(g => g.status === 'live').length

  return (
    <section className="space-y-5">

      {/* Page header */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
                Schedule
              </h1>
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold badge-live">
                  <span className="live-dot" style={{ width: '5px', height: '5px' }} />
                  {liveCount} Live
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
              {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--status-live)' }} />
              Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--fd-maroon)' }} />
              Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--neutral-300)' }} />
              Final
            </span>
          </div>
        </div>
      </div>

      {!tournament || games.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            No games yet. Seed data or add games from admin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([label, dayGames], dayIdx) => (
            <div
              key={label}
              className="overflow-hidden rounded-xl border bg-white animate-fade-up"
              style={{
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-card)',
                animationDelay: `${dayIdx * 80}ms`,
              }}
            >
              {/* Day header */}
              <div
                className="flex items-center justify-between px-5 py-3.5 border-b"
                style={{ background: 'var(--neutral-50)', borderColor: 'var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>
                  {label}
                </h2>
                <span className="text-xs" style={{ color: 'var(--neutral-400)' }}>
                  {dayGames.length} {dayGames.length === 1 ? 'game' : 'games'}
                </span>
              </div>

              {/* Games */}
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {dayGames.map(game => (
                  <GameRow key={game.id} game={game} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
