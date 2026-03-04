export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'

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

function statusBadge(status: 'scheduled' | 'live' | 'final') {
  if (status === 'live') return 'badge-live'
  if (status === 'final') return 'badge-final'
  return 'badge-upcoming'
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
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

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Schedule</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {!tournament || games.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
          No games yet. Seed data or add games from admin.
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([label, dayGames]) => (
            <div key={label} className="rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border-subtle)' }}>
                {label}
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {dayGames.map((game) => (
                  <div key={game.id} className="grid gap-2 px-4 py-4 sm:grid-cols-[110px_1fr_auto] sm:items-center">
                    <div className="text-sm text-neutral-600">
                      {new Date(game.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {game.venue ? <div className="text-xs text-neutral-500">{game.venue}</div> : null}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {game.awayTeam.displayName} <span className="text-neutral-500">vs</span> {game.homeTeam.displayName}
                      </p>
                      {game.status === 'final' && game.homeScore != null && game.awayScore != null ? (
                        <p className="text-sm text-neutral-600">
                          Final: {game.awayScore} - {game.homeScore}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadge(game.status)}`}>
                        {game.status.toUpperCase()}
                      </span>

                      {game.streamUrl ? (
                        <Link href={game.streamUrl} target="_blank" className="text-xs font-medium" style={{ color: 'var(--fd-maroon)' }}>
                          Watch
                        </Link>
                      ) : null}
                      {game.ticketUrl ? (
                        <Link href={game.ticketUrl} target="_blank" className="text-xs font-medium" style={{ color: 'var(--fd-maroon)' }}>
                          Tickets
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
