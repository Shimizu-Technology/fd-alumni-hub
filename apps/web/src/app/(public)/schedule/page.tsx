export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import Link from 'next/link'
import { getSchedule } from '@/lib/services/public-feed'
import { DIVISIONS, getBracketCode, resolveGameDivision, getDivision } from '@/lib/divisions'

export const metadata: Metadata = {
  title: 'Schedule',
}

type ScheduleGame = {
  id: string
  startTime: Date
  venue: string | null
  status: 'scheduled' | 'live' | 'final'
  homeScore: number | null
  awayScore: number | null
  streamUrl: string | null
  ticketUrl: string | null
  division: string | null
  bracketCode: string | null
  notes?: string | null
  homeTeam: { displayName: string; division: string | null }
  awayTeam: { displayName: string; division: string | null }
}

function dayKey(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function StatusBadge({ status }: { status: 'scheduled' | 'live' | 'final' }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider badge-live">
        <span className="live-dot" style={{ width: '5px', height: '5px', flexShrink: 0 }} />
        Live
      </span>
    )
  }
  if (status === 'final') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-final">
        Final
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider badge-upcoming">
      Upcoming
    </span>
  )
}

function BracketBadge({ code, divisionId }: { code: string; divisionId?: string | null }) {
  const bracketInfo = getBracketCode(code)
  const divInfo = divisionId ? getDivision(divisionId) : undefined
  const color = divInfo?.color ?? '#6b7a8d'

  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
      title={bracketInfo?.label ?? code}
    >
      {code}
    </span>
  )
}

function DivisionPip({ divisionId }: { divisionId: string | null | undefined }) {
  const div = getDivision(divisionId)
  if (!div) return null
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: div.color }}
      title={div.label}
    />
  )
}

function ExternalIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

function GameRow({ game }: { game: ScheduleGame }) {
  const isLive = game.status === 'live'
  const isFinal = game.status === 'final'
  const hasScore = isFinal && game.homeScore != null && game.awayScore != null
  const effectiveDivision = resolveGameDivision(game.division, game.homeTeam.division)
  const isFatherSon = game.bracketCode === 'FS' || /\bFS\b/i.test(game.homeTeam.displayName) || /\bFS\b/i.test(game.awayTeam.displayName)

  return (
    <div
      className="group relative px-5 py-4 transition-colors duration-150 hover:bg-neutral-50"
      style={{
        borderLeft: isLive ? '3px solid var(--status-live)' : '3px solid transparent',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">

        {/* Time + venue */}
        <div className="shrink-0 w-28">
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--neutral-700)' }}>
            {new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
          {game.venue && (
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--neutral-400)' }}>{game.venue}</p>
          )}
        </div>

        {/* Matchup */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <DivisionPip divisionId={effectiveDivision} />
            <span className="font-semibold text-sm" style={{ color: 'var(--fd-ink)' }}>{game.awayTeam.displayName}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--neutral-400)' }}>vs</span>
            <span className="font-semibold text-sm" style={{ color: 'var(--fd-ink)' }}>{game.homeTeam.displayName}</span>
          </div>
          {hasScore && (
            <p className="mt-1 text-sm font-bold tabular-nums" style={{ color: 'var(--fd-maroon)' }}>
              {game.awayScore} &ndash; {game.homeScore}
            </p>
          )}
        </div>

        {/* Bracket code + status + actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {game.bracketCode && (
            <BracketBadge code={game.bracketCode} divisionId={effectiveDivision} />
          )}
          {isFatherSon && (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ background: '#1d4ed814', color: '#1d4ed8', border: '1px solid #1d4ed830' }}>
              Father-Son
            </span>
          )}
          <StatusBadge status={game.status} />
          {game.streamUrl && (
            <div className="flex flex-col items-end gap-0.5">
              <Link
                href={game.streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: 'var(--fd-maroon)', color: '#fff' }}
              >
                Watch <ExternalIcon />
              </Link>
              <span className="text-[9px] font-medium tracking-wide" style={{ color: 'var(--neutral-400)' }}>
                Streams by Clutch
              </span>
            </div>
          )}
          {game.ticketUrl && (
            <div className="flex flex-col items-end gap-0.5">
              <Link
                href={game.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 hover:-translate-y-0.5"
                style={{ background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}
              >
                Tickets <ExternalIcon />
              </Link>
              <span className="text-[9px] font-medium tracking-wide" style={{ color: 'var(--neutral-400)' }}>
                Tickets by GuamTime
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function buildScheduleUrl({
  basePath = '/schedule',
  division,
  phase,
  tournamentId,
}: {
  basePath?: string
  division?: string | null
  phase?: string | null
  tournamentId?: string | null
}) {
  const p = new URLSearchParams()
  if (division) p.set('division', division)
  if (phase) p.set('phase', phase)
  if (tournamentId) p.set('tournamentId', tournamentId)
  const q = p.toString()
  return `${basePath}${q ? `?${q}` : ''}`
}

function DivisionTabs({
  activeDivisions,
  currentFilter,
  basePath,
  phaseFilter,
  tournamentId,
}: {
  activeDivisions: string[]
  currentFilter: string | null
  basePath: string
  phaseFilter: string | null
  tournamentId: string | null
}) {
  if (activeDivisions.length < 2) return null

  // Order tabs by DIVISIONS config sortOrder
  const orderedDivisions = DIVISIONS
    .filter(d => activeDivisions.includes(d.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by division">
      {/* All tab */}
      <Link
        href={buildScheduleUrl({ basePath, phase: phaseFilter, tournamentId })}
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
            href={buildScheduleUrl({ basePath, division: div.id, phase: phaseFilter, tournamentId })}
            role="tab"
            aria-selected={isActive}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150"
            style={
              isActive
                ? { background: div.color, color: '#fff' }
                : { background: div.colorMuted, color: div.color, border: `1px solid ${div.color}30` }
            }
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: isActive ? 'rgba(255,255,255,0.7)' : div.color }}
            />
            {div.label}
          </Link>
        )
      })}
    </div>
  )
}

function PhaseTabs({ currentPhase, phases, divisionFilter, tournamentId }: { currentPhase: string | null; phases: string[]; divisionFilter: string | null; tournamentId: string | null }) {
  if (phases.length < 2) return null
  const qp = (phase: string | null) => {
    const p = new URLSearchParams()
    if (divisionFilter) p.set('division', divisionFilter)
    if (tournamentId) p.set('tournamentId', tournamentId)
    if (phase) p.set('phase', phase)
    const q = p.toString()
    return `/schedule${q ? `?${q}` : ''}`
  }
  const labels: Record<string, string> = { pool: 'Pool', playoff: 'Playoffs', fatherson: 'Father-Son' }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter by phase">
      <Link href={qp(null)} className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold" style={!currentPhase ? { background: 'var(--fd-ink)', color: '#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-600)', border: '1px solid var(--border-subtle)' }}>All phases</Link>
      {['pool','playoff','fatherson'].filter(k => phases.includes(k)).map(k => (
        <Link key={k} href={qp(k)} className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold" style={currentPhase===k ? { background: 'var(--fd-maroon)', color:'#fff' } : { background: 'var(--neutral-100)', color: 'var(--neutral-700)', border: '1px solid var(--border-subtle)' }}>{labels[k]}</Link>
      ))}
    </div>
  )
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ division?: string; phase?: 'pool' | 'playoff' | 'fatherson'; tournamentId?: string }>
}) {
  const params = await searchParams
  const divisionFilter = params.division ?? null
  const phaseFilter = params.phase ?? null
  const tournamentId = params.tournamentId ?? null

  const { tournament, games, divisions, phases } = await getSchedule(tournamentId ?? undefined, divisionFilter, phaseFilter)
  const typedGames = games as ScheduleGame[]

  // Group by day
  const grouped: Record<string, ScheduleGame[]> = {}
  for (const game of typedGames) {
    const key = dayKey(new Date(game.startTime))
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(game)
  }
  const days = Object.entries(grouped)
  const liveCount = typedGames.filter(g => g.status === 'live').length

  return (
    <section className="space-y-5">

      {/* Page header */}
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold md:text-3xl" style={{ color: 'var(--fd-maroon)' }}>
                Schedule
              </h1>
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold badge-live">
                  <span className="live-dot" style={{ width: '5px', height: '5px' }} />
                  {liveCount} Live
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
              {tournament ? `${tournament.name} ${tournament.year}` : 'No active tournament loaded yet.'}
            </p>
          </div>

          {/* Status legend */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--neutral-500)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--status-live)' }} />Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--fd-maroon)' }} />Upcoming
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--neutral-300)' }} />Final
            </span>
          </div>
        </div>

        {/* Division filter tabs */}
        <DivisionTabs
          activeDivisions={divisions}
          currentFilter={divisionFilter}
          basePath="/schedule"
          phaseFilter={phaseFilter}
          tournamentId={tournamentId}
        />
        <PhaseTabs currentPhase={phaseFilter} phases={phases} divisionFilter={divisionFilter} tournamentId={tournamentId} />
      </div>

      {!tournament || typedGames.length === 0 ? (
        <div
          className="rounded-xl border bg-white p-10 text-center animate-fade-up delay-75"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            {divisionFilter || phaseFilter
              ? `No games found for current filters${divisionFilter ? ` (${divisionFilter})` : ''}${phaseFilter ? ` (${phaseFilter})` : ''}.`
              : 'No games yet. Seed data or add games from admin.'}
          </p>
          {divisionFilter && (
            <Link
              href="/schedule"
              className="mt-3 inline-block text-xs font-medium"
              style={{ color: 'var(--fd-maroon)' }}
            >
              Show all divisions
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(([label, dayGames], dayIdx) => (
            <div
              key={label}
              className="overflow-hidden rounded-xl border bg-white animate-fade-up"
              style={{
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-card)',
                animationDelay: `${dayIdx * 80}ms`,
              }}
            >
              {/* Day header */}
              <div
                className="flex items-center justify-between px-5 py-3.5 border-b"
                style={{ background: 'var(--neutral-50)', borderColor: 'var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>{label}</h2>
                <span className="text-xs" style={{ color: 'var(--neutral-400)' }}>
                  {dayGames.length} {dayGames.length === 1 ? 'game' : 'games'}
                </span>
              </div>

              {/* Games */}
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {dayGames.map(game => <GameRow key={game.id} game={game} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Division legend (when showing all) */}
      {!divisionFilter && divisions.length > 1 && (
        <div
          className="rounded-xl border bg-white p-4 animate-fade-up"
          style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)', animationDelay: `${days.length * 80 + 80}ms` }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: 'var(--neutral-500)' }}>
            Division Guide
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {DIVISIONS.filter(d => divisions.includes(d.id))
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(div => (
                <div key={div.id} className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: div.color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--neutral-700)' }}>{div.label}</span>
                  <span className="text-xs" style={{ color: 'var(--neutral-400)' }}>{div.description}</span>
                </div>
              ))
            }
          </div>
          {/* Bracket code legend */}
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--neutral-500)' }}>
              Bracket Codes
            </p>
            <div className="flex flex-wrap gap-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
              {[
                ['MP', 'Maroon Playoff'], ['WMP', 'Winner Maroon Playoff'],
                ['GP', 'Gold Playoff'], ['WGP', 'Winner Gold Playoff'],
                ['PP', 'Platinum Playoff'], ['WPP', 'Winner Platinum Playoff'],
                ['QF', 'Quarterfinal'], ['SF', 'Semifinal'], ['F', 'Final'],
              ].map(([code, label]) => (
                <span key={code} className="flex items-center gap-1">
                  <span className="font-bold" style={{ color: 'var(--fd-ink)' }}>{code}</span>
                  <span>= {label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
