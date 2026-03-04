export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { db } from '@/lib/db'

export default async function HistoryPage() {
  const tournaments = await db.tournament.findMany({
    orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
    include: {
      standings: {
        include: { team: true },
        orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { pointsFor: 'desc' }],
        take: 1,
      },
      media: {
        orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
      _count: { select: { games: true, articles: true, media: true } },
    },
    take: 20,
  })

  return (
    <section className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>Tournament History</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          Browse current and past FD Alumni tournaments, results context, articles, and brackets.
        </p>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          No tournaments found yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tournaments.map((t) => {
            const leader = t.standings[0]?.team?.displayName ?? null
            return (
              <article key={t.id} className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-ink)' }}>
                    {t.year} {t.name}
                  </h2>
                  <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)', color: 'var(--neutral-600)' }}>
                    {t.status}
                  </span>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
                  {t._count.games} games · {t._count.articles} articles · {t._count.media} media
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--neutral-500)' }}>
                  {leader ? `Current leader/champion signal: ${leader}` : 'Champion pending score completion'}
                </p>
                {t.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.media[0].imageUrl} alt={`${t.year} featured`} className="mt-3 h-28 w-full rounded-md object-cover" />
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }} href={`/schedule?tournamentId=${encodeURIComponent(t.id)}`}>Schedule</Link>
                  <Link className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }} href={`/standings?tournamentId=${encodeURIComponent(t.id)}`}>Standings</Link>
                  <Link className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }} href={`/watch?tournamentId=${encodeURIComponent(t.id)}`}>Watch</Link>
                  <Link className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: 'var(--border-subtle)' }} href={`/news?tournamentId=${encodeURIComponent(t.id)}`}>News</Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
