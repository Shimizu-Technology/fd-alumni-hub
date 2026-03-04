export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getHomeFeed } from '@/lib/services/public-feed'
import { QuickCard } from '@/components/quick-card'
import { LiveUpdates } from '@/components/live-updates'

export default async function Home() {
  const {
    tournament,
    upcomingOrLiveTournament,
    latestResultsTournament,
    todayGames,
    liveGames,
    latestNews,
  } = await getHomeFeed()

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border bg-white p-6 md:p-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-[color:var(--fd-maroon)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-blue-400/10 blur-2xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Official Tournament Hub</p>
          <h1 className="mt-2 text-4xl font-bold leading-tight md:text-5xl" style={{ color: 'var(--fd-maroon)' }}>
            FD Alumni Basketball
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-neutral-600 md:text-lg">
            {tournament
              ? `${tournament.name} ${tournament.year} — live schedule, standings, watch links, and verified updates in one place.`
              : 'Single source of truth for schedule, standings, watch links, tickets, and updates.'}
          </p>

          <div className="mt-4 rounded-xl border bg-white/90 px-4 py-3 text-sm text-neutral-700" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="font-semibold">Now:</span>{' '}
            {upcomingOrLiveTournament
              ? `${upcomingOrLiveTournament.year} ${upcomingOrLiveTournament.status.toUpperCase()}`
              : 'No live/upcoming tournament set'}
            {' · '}
            <span className="font-semibold">Latest results:</span>{' '}
            {latestResultsTournament
              ? `${latestResultsTournament.year} COMPLETED`
              : 'No completed tournament data yet'}
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/schedule" className="rounded-xl px-4 py-2.5 font-medium text-white shadow-sm hover:-translate-y-0.5" style={{ background: 'var(--fd-maroon)' }}>View Schedule</Link>
            <Link href="/standings" className="rounded-xl border bg-white px-4 py-2.5 font-medium text-[color:var(--fd-ink)] hover:-translate-y-0.5" style={{ borderColor: 'var(--border-subtle)' }}>View Standings</Link>
            <Link href="/watch" className="rounded-xl border bg-white px-4 py-2.5 font-medium text-[color:var(--fd-ink)] hover:-translate-y-0.5" style={{ borderColor: 'var(--border-subtle)' }}>Watch Games</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard title="Games Today" value={String(todayGames.length)} />
        <QuickCard title="Live Now" value={String(liveGames.length)} />
        <QuickCard title="Updates" value={String(latestNews.length)} />
        <QuickCard title="Status" value={tournament ? tournament.status.toUpperCase() : 'NO DATA'} />
      </div>

      <LiveUpdates items={latestNews as any} />
    </section>
  )
}
