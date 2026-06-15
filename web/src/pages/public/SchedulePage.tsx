import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { formatGuamDateTime, guamDayLabel, isPastGuamGame } from '../../lib/datetime'
import { useAsync } from '../../lib/hooks'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import type { Game } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'
import { IconArrowRight, IconExternal } from '../../components/Icons'

export function SchedulePage() {
  const [division, setDivision] = useState('')
  const [phase, setPhase] = useState('')
  const { data, loading, error, reload } = useAsync(() => api.publicSchedule({ division, phase }), [division, phase])

  const grouped = useMemo(() => groupGamesByDay(data?.games || []), [data?.games])

  if (loading && !data) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data?.tournament ? `${data.tournament.year} tournament` : 'Schedule'}
        title="Tournament schedule"
        description="Game times are shown for Guam. Ticket and stream buttons route to partner platforms when links are available."
      />

      <Panel className="watch-hero today-schedule-callout">
        <div>
          <h2>Today at The Jungle</h2>
          <p>Mobile-first game-day info, roster notes, live links, and fan predictions.</p>
        </div>
        <Link className="btn primary" to="/today">Open Today <IconArrowRight /></Link>
      </Panel>

      <Panel className="toolbar-panel">
        <label><span>Division</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{data?.divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>Phase</span><select value={phase} onChange={(event) => setPhase(event.target.value)}><option value="">All phases</option>{data?.phases.map((item) => <option key={item} value={item}>{labelPhase(item)}</option>)}</select></label>
      </Panel>

      {grouped.length === 0 ? (
        <EmptyState title="No games match this view" description="Clear filters or check back once organizers load the next schedule." />
      ) : (
        grouped.map(([day, games]) => (
          <section className="day-section" key={day}>
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
        <span>{formatGuamDateTime(game.startTime)}</span>
        <StatusBadge status={resultPending ? 'result-pending' : game.status} />
      </div>
      <div className="matchup">
        <TeamLine name={game.awayTeam?.displayName || 'Away team'} score={game.awayScore} showScore={scoreReady} />
        <TeamLine name={game.homeTeam?.displayName || 'Home team'} score={game.homeScore} showScore={scoreReady} />
      </div>
      <div className="game-meta">
        <span>{game.venue || DEFAULT_GAME_VENUE}</span>
        {(game.division || game.homeTeam?.division) && <span>{game.division || game.homeTeam?.division}</span>}
        {game.bracketCode && <span>{game.bracketCode}</span>}
      </div>
      <div className="game-actions">
        {game.ticketUrl ? <a className="btn secondary small" href={game.ticketUrl} target="_blank" rel="noreferrer">Tickets <IconExternal /></a> : <span className="link-muted">Ticket link pending</span>}
        {game.streamUrl ? <a className="btn secondary small" href={game.streamUrl} target="_blank" rel="noreferrer">Stream <IconExternal /></a> : <span className="link-muted">Stream link pending</span>}
      </div>
    </article>
  )
}

function TeamLine({ name, score, showScore }: { name: string; score: number | null; showScore: boolean }) {
  return <div className="team-line"><strong>{name}</strong><span>{showScore ? score : '—'}</span></div>
}

function groupGamesByDay(games: Game[]) {
  const groups = new Map<string, Game[]>()
  games.forEach((game) => {
    const key = guamDayLabel(game.startTime)
    groups.set(key, [...(groups.get(key) || []), game])
  })
  return Array.from(groups.entries())
}

function labelPhase(phase: string) {
  if (phase === 'fatherson') return 'Father-Son'
  return phase.charAt(0).toUpperCase() + phase.slice(1)
}
