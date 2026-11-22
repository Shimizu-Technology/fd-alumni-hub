import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../lib/api'
import { boxScoreCoverageLabels, boxScoreMetrics, type PlayerStat } from '../lib/boxScores'
import { useAsync } from '../lib/hooks'
import type { Game } from '../lib/types'
import { ErrorState, LoadingState } from './ui'

export function GameBoxScoreButton({ game }: { game: Game }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  if (game.status !== 'final' || !game.hasPublishedBoxScore) return null

  return (
    <>
      <button ref={trigger} className="btn secondary small" type="button" aria-haspopup="dialog"
        onClick={() => setOpen(true)}>Box Score</button>
      {open && <GameBoxScoreDrawer gameId={game.id} onClose={() => { setOpen(false); trigger.current?.focus() }} />}
    </>
  )
}

export function GameBoxScoreDrawer({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const { data, loading, error, reload } = useAsync(() => api.publicGameBoxScore(gameId), [gameId])
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { if (element?.open) element.close() }
  }, [])

  function close() {
    dialog.current?.close()
    onClose()
  }

  return (
    <dialog ref={dialog} className="game-box-score-drawer" aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); close() }}>
      <header className="section-heading">
        <h2 id={headingId}>Box score</h2>
        <button className="btn secondary small" type="button" autoFocus onClick={close}>Close</button>
      </header>
      {loading ? <LoadingState label="Loading box score" /> : error ? <ErrorState message={error} onRetry={reload} /> : data && (
        <>
          <div className="box-score-actions">
            <span className="box-score-badge">{boxScoreCoverageLabels[data.coverage]}</span>
            {data.underReview && <span className="box-score-badge box-score-warning">Under review</span>}
          </div>
          <TeamBoxScore title={`Home · ${data.game.homeTeam?.displayName ?? 'Home team'}`} stats={data.homeStats} />
          <TeamBoxScore title={`Away · ${data.game.awayTeam?.displayName ?? 'Away team'}`} stats={data.awayStats} />
        </>
      )}
    </dialog>
  )
}

function TeamBoxScore({ title, stats }: { title: string; stats: PlayerStat[] }) {
  return (
    <section className="public-box-score-team">
      <h3>{title}</h3>
      {stats.length ? (
        <div className="table-wrap box-score-table" tabIndex={0} role="region" aria-label={title}>
          <table className="data-table" aria-label={title}>
            <thead><tr><th scope="col">Player</th>
              {boxScoreMetrics.map(({ key, short, label }) => <th scope="col" key={key} title={label}>{short}</th>)}
            </tr></thead>
            <tbody>{stats.map((stat) => (
              <tr key={stat.rosterEntryId}>
                <th scope="row">{stat.jerseyNumber && `#${stat.jerseyNumber} `}{stat.playerName}</th>
                {boxScoreMetrics.map(({ key }) => <td key={key}>{stat[key] ?? '—'}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="muted">No player lines recorded.</p>}
    </section>
  )
}
