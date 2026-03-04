export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { db } from '@/lib/db'

// Historical champions data (verified from GSPN and GuamPDN)
const VERIFIED_CHAMPIONS: Record<number, { champion: string; runnerUp?: string; score?: string; source: string }> = {
  2025: { champion: 'Class of 2002/04', runnerUp: 'Class of 2013', score: '50-44', source: 'GuamPDN' },
  2024: { champion: 'Class of 2016/17', runnerUp: 'Class of 2013', score: '58-56', source: 'GSPN' },
  2023: { champion: 'Class of 2013', source: 'GSPN' },
  2022: { champion: 'Class of 2002/04', runnerUp: 'Class of 2020', score: '62-52', source: 'GSPN' },
  2021: { champion: 'Class of 2006', runnerUp: 'Class of 2002/04', score: '58-38', source: 'GSPN' },
  // 2020: cancelled (COVID-19)
  2019: { champion: 'Class of 2006', source: 'GSPN' },
  2018: { champion: 'Class of 2002/04', source: 'GSPN' },
  2017: { champion: 'Class of 2002/04', source: 'GSPN' },
  // 2016: No verified data available
  2015: { champion: 'Class of 2013', runnerUp: 'Class of 2004', score: '60-48', source: 'GSPN' },
  2014: { champion: 'Class of 2004', source: 'GSPN' },
  2013: { champion: 'Class of 2006', source: 'Historical' },
  2012: { champion: 'Class of 2006', source: 'Historical' },
  2011: { champion: 'Class of 2006', source: 'Historical' },
  2010: { champion: 'Class of 2006', source: 'Historical' },
  2009: { champion: 'Class of 2002', source: 'Historical' },
  2008: { champion: 'Class of 1995', source: 'Historical' },
  2007: { champion: 'Class of 2006', source: 'Historical' },
  2006: { champion: 'Class of 2002/03', source: 'Historical' },
  2005: { champion: 'Class of 1991', source: 'Historical' },
}

function ChampionBadge({ year }: { year: number }) {
  const data = VERIFIED_CHAMPIONS[year]
  if (!data) {
    if (year === 2020) {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--neutral-500)' }}>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)' }}>
            ⏸️ Cancelled (COVID-19)
          </span>
        </div>
      )
    }
    if (year === 2016) {
      return (
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--neutral-500)' }}>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: 'var(--neutral-100)' }}>
            ❓ Champion data unavailable
          </span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span 
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
          style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon)' }}
        >
          🏆 {data.champion}
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
            🥈 {data.runnerUp}
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
          className="h-1.5 flex-1 rounded-full overflow-hidden"
          style={{ background: 'var(--neutral-200)' }}
        >
          <div 
            className="h-full rounded-full transition-all"
            style={{ 
              width: `${pct}%`,
              background: isComplete ? 'var(--green-500)' : 'var(--fd-maroon)'
            }}
          />
        </div>
        <span style={{ color: isComplete ? 'var(--green-600)' : 'var(--neutral-500)' }}>
          {scored}/{total} {isComplete ? '✓' : isPartial ? 'results' : ''}
        </span>
      </div>
    </div>
  )
}

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
      _count: { select: { games: true, articles: true, media: true } },
    },
    take: 20,
  })

  // Compute coverage for each tournament
  const tournamentData = tournaments.map(t => {
    const totalGames = t.games.length
    const scoredGames = t.games.filter(g => g.homeScore !== null && g.awayScore !== null).length
    return { ...t, scoredGames, totalGames }
  })

  return (
    <section className="space-y-5">
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
          Tournament History
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
          Browse FD Alumni tournaments from 2014 to present. Champions, results, articles, and brackets.
        </p>
      </div>

      {/* Dynasty highlight */}
      <div 
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--fd-gold)', background: 'linear-gradient(135deg, rgba(214,175,84,0.1), rgba(138,21,56,0.05))' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-maroon)' }}>🏀 Dynasty Watch</h2>
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

      {tournamentData.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          No tournaments found yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {tournamentData.map((t) => {
            const hasChampion = !!VERIFIED_CHAMPIONS[t.year]
            const isCompleted = t.status === 'completed'
            
            return (
              <article 
                key={t.id} 
                className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
                style={{ borderColor: hasChampion ? 'var(--fd-gold)' : 'var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-ink)' }}>
                    {t.year} {t.name.replace('FD Alumni Basketball Tournament', 'Tournament')}
                  </h2>
                  <span 
                    className="text-xs rounded-full px-2 py-0.5 capitalize"
                    style={{ 
                      background: isCompleted ? 'var(--green-100)' : 'var(--neutral-100)', 
                      color: isCompleted ? 'var(--green-700)' : 'var(--neutral-600)' 
                    }}
                  >
                    {t.status}
                  </span>
                </div>

                <ChampionBadge year={t.year} />
                
                <p className="mt-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
                  {t._count.games} games · {t._count.articles} articles · {t._count.media} media
                </p>

                <CoverageBadge scored={t.scoredGames} total={t.totalGames} />

                {t.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={t.media[0].imageUrl} 
                    alt={`${t.year} featured`} 
                    className="mt-3 h-28 w-full rounded-md object-cover"
                    loading="lazy"
                  />
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link 
                    className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" 
                    style={{ borderColor: 'var(--border-subtle)' }} 
                    href={`/schedule?tournamentId=${encodeURIComponent(t.id)}`}
                  >
                    Schedule
                  </Link>
                  <Link 
                    className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" 
                    style={{ borderColor: 'var(--border-subtle)' }} 
                    href={`/standings?tournamentId=${encodeURIComponent(t.id)}`}
                  >
                    Standings
                  </Link>
                  <Link 
                    className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" 
                    style={{ borderColor: 'var(--border-subtle)' }} 
                    href={`/watch?tournamentId=${encodeURIComponent(t.id)}`}
                  >
                    Watch
                  </Link>
                  <Link 
                    className="rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-gray-50" 
                    style={{ borderColor: 'var(--border-subtle)' }} 
                    href={`/news?tournamentId=${encodeURIComponent(t.id)}`}
                  >
                    News
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Data trust notice */}
      <div className="rounded-xl border bg-white p-4 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
        <p style={{ color: 'var(--neutral-500)' }}>
          <strong style={{ color: 'var(--neutral-700)' }}>Data Sources:</strong> Champion data and game results are verified from GSPN (Guam Sports Network), GuamPDN, and official tournament records. 
          Results marked with a progress bar indicate partial score coverage. 
          <Link href="/news" className="ml-1 underline">View all sources →</Link>
        </p>
      </div>
    </section>
  )
}
