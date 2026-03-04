export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'

export const metadata: Metadata = {
  title: 'Watch',
}

type WatchGame = {
  id: string
  streamUrl: string | null
  status: 'scheduled' | 'live' | 'final' | string
  startTime: Date
  homeTeam: { displayName: string }
  awayTeam: { displayName: string }
}

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

function GameStreamCard({ game }: { game: WatchGame }) {
  const isLive = game.status === 'live'
  const isFinal = game.status === 'final'
  const date = new Date(game.startTime)

  return (
    <div
      className="group relative overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        borderColor: isLive ? 'var(--status-live)' : 'var(--border-subtle)',
        boxShadow: isLive ? '0 0 0 1px var(--status-live), var(--shadow-card)' : 'var(--shadow-card)',
      }}
    >
      {/* Live indicator stripe */}
      {isLive && (
        <div className="h-1 w-full" style={{ background: 'var(--status-live)' }} />
      )}

      <div className="p-5">
        {/* Status + time */}
        <div className="flex items-center justify-between mb-4">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider badge-live">
              <span className="live-dot" style={{ width: '5px', height: '5px' }} />
              Live Now
            </span>
          ) : isFinal ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-final">
              Replay
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-upcoming">
              Upcoming
            </span>
          )}
          <span className="text-xs tabular-nums" style={{ color: 'var(--neutral-400)' }}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {/* Matchup */}
        <div className="mb-5">
          <p className="font-bold text-base leading-snug" style={{ color: 'var(--fd-ink)' }}>
            {game.awayTeam.displayName}
          </p>
          <p className="text-xs font-medium my-1" style={{ color: 'var(--neutral-400)' }}>vs</p>
          <p className="font-bold text-base leading-snug" style={{ color: 'var(--fd-ink)' }}>
            {game.homeTeam.displayName}
          </p>
        </div>

        {/* Watch button */}
        <Link
          href={game.streamUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          style={{
            background: isLive ? 'var(--status-live)' : 'var(--fd-maroon)',
            color: '#fff',
            boxShadow: isLive ? '0 4px 16px rgba(224,36,62,0.3)' : 'var(--shadow-maroon)',
          }}
        >
          <PlayIcon />
          {isLive ? 'Watch Live' : isFinal ? 'Watch Replay' : 'Open Stream'}
          <ExternalIcon />
        </Link>
        <p className="text-center text-[10px] font-medium mt-1" style={{ color: 'var(--neutral-400)' }}>
          Streams by Clutch
        </p>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>
      {children}
    </h2>
  )
}

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tournamentId?: string }>
}) {
  const params = await searchParams
  const tournamentId = params.tournamentId ?? undefined
  const { tournament, games } = await getSchedule(tournamentId)
  const typedGames = games as WatchGame[]
  const withStreams = typedGames.filter(g => !!g.streamUrl)
  const live = withStreams.filter(g => g.status === 'live')
  const upcoming = withStreams.filter(g => g.status === 'scheduled')
  const replays = withStreams.filter(g => g.status === 'final')

  return (
    <section className="space-y-8">

      {/* Page header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          Watch
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {withStreams.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex justify-center mb-3">
            <PlayIcon size={28} />
          </div>
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            No stream links yet. Add stream URLs to games from the admin panel.
          </p>
        </div>
      ) : (
        <>
          {/* Live games */}
          {live.length > 0 && (
            <div className="space-y-3 animate-fade-up delay-75">
              <SectionLabel>Live Now</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map(g => <GameStreamCard key={g.id} game={g} />)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-3 animate-fade-up delay-150">
              <SectionLabel>Upcoming Streams</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map(g => <GameStreamCard key={g.id} game={g} />)}
              </div>
            </div>
          )}

          {/* Replays */}
          {replays.length > 0 && (
            <div className="space-y-3 animate-fade-up delay-225">
              <SectionLabel>Replays</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {replays.map(g => <GameStreamCard key={g.id} game={g} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Partner attribution */}
      {withStreams.length > 0 && (
        <div
          className="rounded-xl border bg-white p-4 animate-fade-up"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: 'var(--neutral-500)' }}>
            Media Partners
          </p>
          <div className="flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>Clutch</p>
                <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>Official streaming partner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>GuamTime</p>
                <p className="text-xs" style={{ color: 'var(--neutral-500)' }}>Official ticketing partner</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
