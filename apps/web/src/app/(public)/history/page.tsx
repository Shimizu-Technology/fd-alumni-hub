export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { db, withDatabaseFallback } from '@/lib/db'
import {
  STATIC_TOURNAMENT_YEARS,
  archiveArticlesForYear,
  archiveMediaForYear,
  championForYear,
} from '@/lib/historical-archive'

function TrophyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function RunnerUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6" />
      <path d="M8.2 13 7 22l5-3 5 3-1.2-9" />
    </svg>
  )
}

function ChampionBadge({ year }: { year: number }) {
  const data = championForYear(year)
  if (!data) return null

  if (data.status === 'cancelled') {
    return (
      <div className="mt-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
        <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)' }}>
          Cancelled{data.note ? ` — ${data.note}` : ''}
        </span>
      </div>
    )
  }

  if (data.status === 'unknown' || !data.champion) {
    return (
      <div className="mt-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
        <span className="inline-flex items-center rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)' }}>
          Champion data unavailable{data.note ? ` — ${data.note}` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
          style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon)' }}
        >
          <TrophyIcon />
          {data.champion}
        </span>
        {data.score && (
          <span
            className="rounded-full px-2 py-0.5 font-mono"
            style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)' }}
          >
            {data.score}
          </span>
        )}
      </div>
      {data.runnerUp && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--neutral-500)' }}>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)' }}>
            <RunnerUpIcon />
            {data.runnerUp}
          </span>
        </div>
      )}
    </div>
  )
}

function CoverageBadge({ scored, total }: { scored: number; total: number }) {
  if (total === 0) return null

  const pct = Math.round((scored / total) * 100)
  const isComplete = pct === 100
  const isPartial = pct > 0 && pct < 100

  return (
    <div className="mt-2 text-xs">
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--neutral-200)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: isComplete ? 'var(--success)' : 'var(--fd-maroon)',
            }}
          />
        </div>
        <span style={{ color: isComplete ? 'var(--success)' : 'var(--neutral-500)' }}>
          {scored}/{total} {isComplete ? 'complete' : isPartial ? 'results' : ''}
        </span>
      </div>
    </div>
  )
}

function yearHref(path: string, tournamentId: string | null, year: number) {
  return tournamentId
    ? `${path}?tournamentId=${encodeURIComponent(tournamentId)}`
    : `${path}?year=${year}`
}

export default async function HistoryPage() {
  const tournaments = await withDatabaseFallback(() => db.tournament.findMany({
    orderBy: [{ year: 'desc' }, { startDate: 'desc' }],
    include: {
      articles: { select: { url: true } },
      media: {
        where: { tags: { contains: 'featured' } },
        orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
        take: 1,
      },
      games: {
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
        },
      },
      _count: { select: { games: true, media: true } },
    },
    take: 50,
  }), [])

  const tournamentByYear = new Map(tournaments.map((t) => [t.year, t]))
  const years = Array.from(new Set([
    ...STATIC_TOURNAMENT_YEARS,
    ...tournaments.map((t) => t.year),
  ])).sort((a, b) => b - a)

  return (
    <section className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          Tournament History
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          Browse FD Alumni tournaments, champions, results, articles, and recovered media from public archives.
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--fd-gold)', background: 'linear-gradient(135deg, rgba(214,175,84,0.1), rgba(138,21,56,0.05))' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-maroon)' }}>Dynasty Watch</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <div>
            <span className="font-medium" style={{ color: 'var(--fd-ink)' }}>Class of 2006</span>
            <p style={{ color: 'var(--neutral-500)' }}>8 titles (2006-2021)</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--fd-ink)' }}>Class of 2002/04</span>
            <p style={{ color: 'var(--neutral-500)' }}>5 titles (2006-2025)</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--fd-ink)' }}>Class of 2013</span>
            <p style={{ color: 'var(--neutral-500)' }}>2 titles (2015, 2023)</p>
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--fd-ink)' }}>Class of 2016/17</span>
            <p style={{ color: 'var(--neutral-500)' }}>1 title (2024)</p>
          </div>
        </div>
      </div>

      {years.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          No tournaments found yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {years.map((year) => {
            const t = tournamentByYear.get(year)
            const archiveArticles = archiveArticlesForYear(year)
            const archiveMedia = archiveMediaForYear(year)
            const totalGames = t?.games.length ?? 0
            const scoredGames = t?.games.filter((g) => g.homeScore !== null && g.awayScore !== null).length ?? 0
            const articleCount = new Set([...(t?.articles.map((a) => a.url) ?? []), ...archiveArticles.map((a) => a.url)]).size
            const mediaCount = Math.max(t?._count.media ?? 0, archiveMedia.length)
            const champion = championForYear(year)
            const isCompleted = t?.status === 'completed' || (!!champion?.champion && champion.status !== 'cancelled')
            const featuredImage = t?.media[0]?.imageUrl ?? archiveMedia.find((m) => m.tags?.includes('featured'))?.imageUrl ?? archiveMedia[0]?.imageUrl
            const tournamentId = t?.id ?? null

            return (
              <article
                key={year}
                className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
                style={{ borderColor: champion?.champion ? 'var(--fd-gold)' : 'var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-ink)' }}>
                    {year} Tournament
                  </h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs capitalize"
                    style={{
                      background: isCompleted ? '#dcfce7' : 'var(--neutral-100)',
                      color: isCompleted ? '#166534' : 'var(--neutral-600)',
                    }}
                  >
                    {champion?.status === 'cancelled' ? 'cancelled' : t?.status ?? 'archive'}
                  </span>
                </div>

                <ChampionBadge year={year} />

                <p className="mt-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
                  {totalGames} games · {articleCount} articles · {mediaCount} media
                </p>

                <CoverageBadge scored={scoredGames} total={totalGames} />

                {featuredImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featuredImage}
                    alt={`${year} featured`}
                    className="mt-3 h-28 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {tournamentId ? (
                    <>
                      <Link className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-subtle)' }} href={yearHref('/schedule', tournamentId, year)}>
                        Schedule
                      </Link>
                      <Link className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-subtle)' }} href={yearHref('/standings', tournamentId, year)}>
                        Standings
                      </Link>
                      <Link className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-subtle)' }} href={yearHref('/watch', tournamentId, year)}>
                        Watch
                      </Link>
                    </>
                  ) : null}
                  <Link className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-subtle)' }} href={yearHref('/news', tournamentId, year)}>
                    News
                  </Link>
                  <Link className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--border-subtle)' }} href={yearHref('/gallery', tournamentId, year)}>
                    Gallery
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
        <p style={{ color: 'var(--neutral-500)' }}>
          <strong style={{ color: 'var(--neutral-700)' }}>Data Sources:</strong> Champion data, article links, and recovered media are attributed to GSPN, GuamPDN, PostGuam, and official tournament records where available. Results marked with a progress bar indicate partial score coverage.
          <Link href="/news" className="ml-1 underline">View all sources</Link>
        </p>
      </div>
    </section>
  )
}
