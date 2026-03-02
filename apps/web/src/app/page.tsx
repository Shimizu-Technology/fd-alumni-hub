export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getHomeFeed } from '@/lib/services/public-feed'
import { QuickCard } from '@/components/quick-card'

export default async function Home() {
  const { tournament, todayGames, liveGames, latestNews } = await getHomeFeed()

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-white p-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--fd-maroon)' }}>FD Alumni Basketball Hub</h1>
        <p className="mt-2 text-neutral-600">
          {tournament
            ? `${tournament.name} ${tournament.year} — your single source for schedule, standings, watch links, tickets, and updates.`
            : 'Single source of truth for schedule, standings, watch links, tickets, and updates.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/schedule" className="rounded-lg px-3 py-2 text-white" style={{ background: 'var(--fd-maroon)' }}>View Schedule</Link>
          <Link href="/standings" className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>View Standings</Link>
          <Link href="/watch" className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>Watch Games</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard title="Games Today" value={String(todayGames.length)} />
        <QuickCard title="Live Now" value={String(liveGames.length)} />
        <QuickCard title="Updates" value={String(latestNews.length)} />
        <QuickCard title="Status" value={tournament ? tournament.status.toUpperCase() : 'NO DATA'} />
      </div>
    </section>
  )
}
