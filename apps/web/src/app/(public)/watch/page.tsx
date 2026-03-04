export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'

type WatchGame = {
  id: string
  streamUrl: string | null
  status: 'scheduled' | 'live' | 'final' | string
  startTime: Date
  homeTeam: { displayName: string }
  awayTeam: { displayName: string }
}

export default async function WatchPage() {
  const { tournament, games } = await getSchedule()
  const typedGames = games as WatchGame[]
  const withStreams = typedGames.filter((g: WatchGame) => !!g.streamUrl)
  const live = withStreams.filter((g: WatchGame) => g.status === 'live')
  const upcoming = withStreams.filter((g: WatchGame) => g.status === 'scheduled')
  const replays = withStreams.filter((g: WatchGame) => g.status === 'final')

  const renderList = (title: string, list: typeof withStreams) => (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="border-b bg-neutral-50 px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border-subtle)' }}>{title}</div>
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {list.length === 0 ? (
          <p className="px-4 py-5 text-sm text-neutral-500">No stream-linked games in this section yet.</p>
        ) : list.map((g) => (
          <div key={g.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-[color:var(--fd-ink)]">{g.awayTeam.displayName} vs {g.homeTeam.displayName}</p>
              <p className="text-xs text-neutral-500">{new Date(g.startTime).toLocaleString('en-US')}</p>
            </div>
            <Link href={g.streamUrl!} target="_blank" className="rounded-xl px-3 py-2 text-xs font-semibold text-white hover:-translate-y-0.5" style={{ background: 'var(--fd-maroon)' }}>
              Open Stream
            </Link>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-white/90 p-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-3xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Watch</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
        </p>
      </div>

      {renderList('Live Now', live)}
      {renderList('Upcoming Streams', upcoming)}
      {renderList('Replays', replays)}
    </section>
  )
}
