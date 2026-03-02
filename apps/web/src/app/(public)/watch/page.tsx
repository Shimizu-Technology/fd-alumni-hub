export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'

export default async function WatchPage() {
  const { tournament, games } = await getSchedule()
  const withStreams = games.filter((g) => !!g.streamUrl)
  const live = withStreams.filter((g) => g.status === 'live')
  const upcoming = withStreams.filter((g) => g.status === 'scheduled')
  const replays = withStreams.filter((g) => g.status === 'final')

  const renderList = (title: string, list: typeof withStreams) => (
    <div className="rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border-subtle)' }}>{title}</div>
      <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {list.length === 0 ? (
          <p className="px-4 py-4 text-sm text-neutral-500">No games in this section yet.</p>
        ) : list.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{g.awayTeam.displayName} vs {g.homeTeam.displayName}</p>
              <p className="text-xs text-neutral-500">{new Date(g.startTime).toLocaleString('en-US')}</p>
            </div>
            <Link href={g.streamUrl!} target="_blank" className="rounded-lg px-3 py-2 text-xs font-medium text-white" style={{ background: 'var(--fd-maroon)' }}>
              Open Stream
            </Link>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Watch</h1>
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
