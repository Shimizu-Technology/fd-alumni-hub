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
        onAnimationEnd={() => setPrevious((current) => current.score === score ? { score, tick: false } : current)}>{score ?? '—'}</span>
    </strong>
  )
}

function gameLabel(game: Game) {
  if (game.status !== 'scheduled') return game.status.toUpperCase()
  return game.dateOnly || !Number.isFinite(Date.parse(game.startTime)) ? 'Tip-off TBA' : formatGuamTime(game.startTime)
}

export function LiveScoreboardStrip({ games }: { games: Game[] }) {
  const headingId = useId()
  const motionOk = useMotionOk()

  if (!games.length) return null

  return (
    <section className="broadcast-strip" aria-labelledby={headingId}>
      <div className="broadcast-head">
        <h2 id={headingId}>The Jungle Scoreboard</h2>
        <nav aria-label="Scoreboard links">
          <Link to="/today">Today</Link>
          <Link to="/tickets">Tickets</Link>
          <Link to="/schedule">Schedule</Link>
        </nav>
      </div>
      <ul className="broadcast-games" tabIndex={games.length > 1 ? 0 : undefined}>
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
      </ul>
    </section>
  )
}
