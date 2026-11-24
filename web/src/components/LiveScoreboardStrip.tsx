import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMotionOk } from '../hooks/useMotionOk'
import { formatGuamTime } from '../lib/datetime'
import type { Game } from '../lib/types'

function ScoreDigit({ score, motionOk }: { score: number | null; motionOk: boolean }) {
  const [previous, setPrevious] = useState({ score, tick: false })
  if (score !== previous.score || (!motionOk && previous.tick)) {
    setPrevious({ score, tick: motionOk && score !== null })
  }

  return (
    <strong className="broadcast-score">
      <span key={score} className={motionOk && previous.tick ? 'broadcast-score-tick' : undefined}
        onAnimationEnd={() => setPrevious((current) => current.score === score ? { score, tick: false } : current)}>
        {score ?? <><span aria-hidden="true">—</span><span className="sr-only">No score yet</span></>}
      </span>
    </strong>
  )
}

function gameLabel(game: Game) {
  if (game.status !== 'scheduled') return game.status.toUpperCase()
  return game.dateOnly || !Number.isFinite(Date.parse(game.startTime)) ? 'Tip-off TBA' : formatGuamTime(game.startTime)
}

export function LiveScoreboardStrip({ games, showEmpty = false }: { games: Game[]; showEmpty?: boolean }) {
  const headingId = useId()
  const motionOk = useMotionOk()

  if (!games.length && !showEmpty) return null

  return (
    <section className="broadcast-strip" aria-labelledby={headingId}>
      <div className="broadcast-head">
        <h1 id={headingId}>The Jungle Scoreboard</h1>
        <nav aria-label="Scoreboard links">
          <Link to="/today">Today</Link>
          <Link to="/tickets">Tickets</Link>
          <Link to="/schedule">Schedule</Link>
        </nav>
      </div>
      {!games.length && <p className="broadcast-empty">Scores will appear when games tip off.</p>}
      {games.length > 0 && <ul className="broadcast-games" aria-label="Tonight's games" tabIndex={games.length > 1 ? 0 : undefined}>
        {games.map((game) => (
          <li key={game.id} className="broadcast-game">
            <span className={`broadcast-status broadcast-status--${game.status}`}>{gameLabel(game)}</span>
            <div className="broadcast-team">
              <span>{game.awayTeam?.displayName || 'Away team'}</span>
              <ScoreDigit score={game.awayScore} motionOk={motionOk} />
            </div>
            <div className="broadcast-team">
              <span>{game.homeTeam?.displayName || 'Home team'}</span>
              <ScoreDigit score={game.homeScore} motionOk={motionOk} />
            </div>
          </li>
        ))}
      </ul>}
    </section>
  )
}
