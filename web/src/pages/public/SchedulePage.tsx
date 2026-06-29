import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { representedClassesLabel } from '../../lib/classes'
import { formatGuamDateTime, formatGuamTime, guamDayLabel, isPastGuamGame } from '../../lib/datetime'
import { useAsync } from '../../lib/hooks'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { externalHref, numericSearchParam } from '../../lib/urls'
import type { Game, TeamSummary } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function SchedulePage() {
  const [year] = useState(() => numericSearchParam('year'))
  const [division, setDivision] = useState('')
  const [phase, setPhase] = useState('')
  const [teamId, setTeamId] = useState(() => new URLSearchParams(window.location.search).get('teamId') || '')
  const { data, loading, error, reload } = useAsync(() => api.publicSchedule({ year, division, phase, teamId }), [year, division, phase, teamId])

  const grouped = useMemo(() => groupGamesByDay(data?.games || []), [data?.games])

  if (loading && !data) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack schedule-page">
      <PageHeader
        eyebrow={data?.tournament ? `${data.tournament.year} tournament` : 'Schedule'}
        title="Tournament schedule"
        description="Game times are shown for Guam. Ticket and stream buttons route to partner platforms when links are available."
        actions={<Link className="btn secondary" to="/info">Rules and ticket info <IconArrowRight /></Link>}
      />

      <Panel className="watch-hero today-schedule-callout compact-callout">
        <div>
          <h2>Today at The Jungle</h2>
          <p>Game-day notes, roster details, live links, and fan predictions.</p>
        </div>
        <Link className="btn primary" to="/today">Open Today <IconArrowRight /></Link>
      </Panel>

      <Panel className="toolbar-panel schedule-filter-panel">
        <label><span>Team entry</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">All team entries</option>{data?.teams.map((team) => <option key={team.id} value={team.id}>{team.displayName}</option>)}</select></label>
        <label><span>Division</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{data?.divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Phase</span><select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="">All phases</option>{data?.phases.map((item) => <option key={item} value={item}>{labelPhase(item)}</option>)}</select></label>
        {(teamId || division || phase) && <button className="btn secondary" type="button" onClick={() => { setTeamId(''); setDivision(''); setPhase('') }}>Clear filters</button>}
      </Panel>

      {grouped.length > 1 && (
        <nav className="schedule-day-jump" aria-label="Schedule day shortcuts">
          {grouped.map(([day, games]) => <a key={day} href={`#${dayAnchorId(day)}`}><strong>{shortDayLabel(day)}</strong><span>{games.length}</span></a>)}
        </nav>
      )}

      {grouped.length === 0 ? (
        <EmptyState title="No games match this view" description="Clear filters or check back once organizers load the next schedule." />
      ) : (
        grouped.map(([day, games]) => (
          <section className="day-section" key={day} id={dayAnchorId(day)}>
            <h2>{day}</h2>
            <div className="game-card-grid">
              {games.map((game) => <GameCard key={game.id} game={game} />)}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function GameCard({ game }: { game: Game }) {
  const scoreReady = game.homeScore !== null && game.awayScore !== null
  const resultPending = game.status === 'scheduled' && isPastGuamGame(game.startTime)

  return (
    <article className="game-card">
      <div className="game-card-top">
        <span className="game-time-mobile">{formatGuamTime(game.startTime)}</span><span className="game-time-full">{formatGuamDateTime(game.startTime)}</span>
        <StatusBadge status={resultPending ? 'result-pending' : game.status} />
      </div>
      <div className="matchup">
        <TeamLine team={game.awayTeam} fallback="Away team" score={game.awayScore} showScore={scoreReady} />
        <TeamLine team={game.homeTeam} fallback="Home team" score={game.homeScore} showScore={scoreReady} />
      </div>
      <div className="game-meta">
        <span>{game.venue || DEFAULT_GAME_VENUE}</span>
        {(game.division || game.homeTeam?.division) && <span>{game.division || game.homeTeam?.division}</span>}
        {game.bracketCode && <span>{game.bracketCode}</span>}
      </div>
      <div className="game-actions">
        {game.ticketUrl ? <a className="btn secondary small" href={externalHref(game.ticketUrl) || undefined} target="_blank" rel="noreferrer">Tickets <IconExternal /></a> : <span className="link-muted">Ticket link pending</span>}
        {game.streamUrl ? <a className="btn secondary small" href={externalHref(game.streamUrl) || undefined} target="_blank" rel="noreferrer">Stream <IconExternal /></a> : <span className="link-muted">Stream link pending</span>}
      </div>
    </article>
  )
}

function TeamLine({ team, fallback, score, showScore }: { team?: TeamSummary | null; fallback: string; score: number | null; showScore: boolean }) {
  return (
    <div className="team-line">
      <div className="team-line-main">
        {team ? <Link to={`/teams/${team.id}`}>{team.displayName}</Link> : <strong>{fallback}</strong>}
        {team && <small>{representedClassesLabel(team)}</small>}
      </div>
      <span>{showScore ? score : '—'}</span>
    </div>
  )
}

function groupGamesByDay(games: Game[]) {
  const groups = new Map<string, Game[]>()
  games.forEach((game) => {
    const key = guamDayLabel(game.startTime)
    groups.set(key, [...(groups.get(key) || []), game])
  })
  return Array.from(groups.entries())
}

function dayAnchorId(day: string) {
  return `schedule-${day.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function shortDayLabel(day: string) {
  return day.replace(/^[^,]+,\s*/, '')
}

function labelPhase(phase: string) {
  if (phase === 'fatherson') return 'Father-Son'
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}
