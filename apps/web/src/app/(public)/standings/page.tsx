export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getStandings } from '@/lib/services/public-feed'
import { DIVISIONS, getDivision } from '@/lib/divisions'

export const metadata: Metadata = {
  title: 'Standings',
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ background: 'var(--fd-gold)', color: 'var(--fd-maroon-deeper)' }} aria-label="1st place">1</span>
  )
  if (rank === 2) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ background: '#c0c8d6', color: '#3a3d47' }} aria-label="2nd place">2</span>
  )
  if (rank === 3) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold" style={{ background: '#d4a574', color: '#4a2a0e' }} aria-label="3rd place">3</span>
  )
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium" style={{ color: 'var(--neutral-400)' }}>{rank}</span>
  )
}

type StandingRow = {
  id: string
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  team: { displayName: string; division: string | null }
}

function DivisionTabs({
  activeDivisions,
  currentFilter,
  basePath,
}: {
  activeDivisions: string[]
  currentFilter: string | null
  basePath: string
}) {
  if (activeDivisions.length < 2) return null

  const orderedDivisions = DIVISIONS
    .filter(d => activeDivisions.includes(d.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by division">
      <Link
        href={basePath}
        role="tab"
        aria-selected={!currentFilter}
        className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150"
        style={
          !currentFilter
            ? { background: 'var(--fd-ink)', color: '#fff' }
            : { background: 'var(--neutral-100)', color: 'var(--neutral-600)', border: '1px solid var(--border-subtle)' }
        }
      >
        All
      </Link>
      {orderedDivisions.map(div => {
        const isActive = currentFilter === div.id
        return (
          <Link
            key={div.id}
            href={`${basePath}?division=${encodeURIComponent(div.id)}`}
            role="tab"
            aria-selected={isActive}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150"
            style={
              isActive
                ? { background: div.color, color: '#fff' }
                : { background: div.colorMuted, color: div.color, border: `1px solid ${div.color}30` }
            }
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: isActive ? 'rgba(255,255,255,0.7)' : div.color }} />
            {div.label}
          </Link>
        )
      })}
    </div>
  )
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string }>
}) {
  const params = await searchParams
  const divisionFilter = params.division ?? null

  const { tournament, standings, divisions } = await getStandings(undefined, divisionFilter)
  const typedStandings = standings as StandingRow[]

  const activeDiv = divisionFilter ? getDivision(divisionFilter) : undefined

  return (
    <section className="space-y-5">

      {/* Page header */}
      <div className="animate-fade-up">
        <div className="mb-4">
          <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
            Standings
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--neutral-500)' }}>
            {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
            {activeDiv ? ` · ${activeDiv.label}` : ''}
          </p>
        </div>

        <DivisionTabs
          activeDivisions={divisions}
          currentFilter={divisionFilter}
          basePath="/standings"
        />
      </div>

      {!tournament || typedStandings.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            {divisionFilter
              ? `No standings found for the ${divisionFilter} division.`
              : 'No standings yet. Add teams and scores from admin.'}
          </p>
          {divisionFilter && (
            <Link href="/standings" className="mt-3 inline-block text-xs font-medium" style={{ color: 'var(--fd-maroon)' }}>
              Show all divisions
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Standings table */}
          <div
            className="overflow-hidden rounded-xl border bg-white animate-fade-up delay-75"
            style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-elevated)' }}
          >
            {/* Division header strip (when a specific division is selected) */}
            {activeDiv && (
              <div
                className="flex items-center gap-2 px-5 py-3 border-b"
                style={{ background: activeDiv.colorMuted, borderColor: `${activeDiv.color}20` }}
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: activeDiv.color }} />
                <span className="text-xs font-semibold" style={{ color: activeDiv.color }}>{activeDiv.label}</span>
                <span className="text-xs ml-1" style={{ color: 'var(--neutral-500)' }}>{activeDiv.description}</span>
              </div>
            )}

            <table className="min-w-full text-sm" role="table" aria-label={`Tournament standings${activeDiv ? ` — ${activeDiv.label}` : ''}`}>
              <thead>
                <tr style={{ background: 'var(--neutral-50)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th scope="col" className="pl-5 pr-2 py-3.5 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>#</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>Team</span>
                  </th>
                  {!divisionFilter && divisions.length > 1 && (
                    <th scope="col" className="px-3 py-3.5 text-left hidden sm:table-cell">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>Div</span>
                    </th>
                  )}
                  <th scope="col" className="px-3 py-3.5 text-center w-16">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>W</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center w-16">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>L</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center w-16 hidden sm:table-cell">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>PF</span>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center w-16 hidden sm:table-cell">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>PA</span>
                  </th>
                  <th scope="col" className="px-3 pr-5 py-3.5 text-center w-20">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--neutral-500)' }}>+/-</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {typedStandings.map((row, idx) => {
                  const rank = idx + 1
                  const diff = row.pointsFor - row.pointsAgainst
                  const isTop = rank <= 3
                  const teamDiv = getDivision(row.team.division)

                  return (
                    <tr
                      key={row.id}
                      className="border-t transition-colors duration-100 hover:bg-neutral-50"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        background: rank === 1 ? 'rgba(217,178,111,0.04)' : undefined,
                      }}
                    >
                      <td className="pl-5 pr-2 py-3.5"><RankBadge rank={rank} /></td>
                      <td className="px-3 py-3.5">
                        <span className="font-semibold" style={{ color: isTop ? 'var(--fd-ink)' : 'var(--neutral-700)' }}>
                          {row.team.displayName}
                        </span>
                      </td>
                      {!divisionFilter && divisions.length > 1 && (
                        <td className="px-3 py-3.5 hidden sm:table-cell">
                          {teamDiv && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ background: teamDiv.colorMuted, color: teamDiv.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: teamDiv.color }} />
                              {teamDiv.id}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-bold tabular-nums" style={{ color: 'var(--neutral-900)' }}>{row.wins}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="tabular-nums" style={{ color: 'var(--neutral-600)' }}>{row.losses}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center hidden sm:table-cell">
                        <span className="tabular-nums text-sm" style={{ color: 'var(--neutral-600)' }}>{row.pointsFor}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center hidden sm:table-cell">
                        <span className="tabular-nums text-sm" style={{ color: 'var(--neutral-600)' }}>{row.pointsAgainst}</span>
                      </td>
                      <td className="px-3 pr-5 py-3.5 text-center">
                        <span className="tabular-nums text-sm font-semibold" style={{ color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : 'var(--neutral-500)' }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Footer legend */}
            <div
              className="flex flex-wrap items-center gap-4 px-5 py-3 border-t"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-50)' }}
            >
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--neutral-500)' }}>
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: 'var(--fd-gold)' }} />
                1st place
              </span>
              <span className="text-xs" style={{ color: 'var(--neutral-400)' }}>
                PF = Points For · PA = Points Against · +/- = Differential
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
