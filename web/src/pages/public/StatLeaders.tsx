import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoadingState, Panel } from '../../components/ui'
import { api } from '../../lib/api'
import type { LeaderMetric, LeaderScope } from '../../lib/boxScores'
import { useAsync } from '../../lib/hooks'

const metrics: [LeaderMetric, string][] = [
  ['points', 'Points'], ['rebounds', 'Rebounds'], ['assists', 'Assists'],
  ['steals', 'Steals'], ['blocks', 'Blocks'], ['three_pointers_made', '3PM'],
]

export function StatLeaders({ tournamentId, division }: { tournamentId: string; division: string }) {
  const [metric, setMetric] = useState<LeaderMetric>('points')
  const [scope, setScope] = useState<LeaderScope>()
  const { data, loading, error, reload } = useAsync(async () => ({
    metric, scope, payload: await api.publicStatLeaders({ tournamentId, division, metric, scope }),
  }), [tournamentId, division, metric, scope])

  if (!error && (!data?.payload.enabled || !data.payload.gamesWithBoxScores)) return null
  const current = data?.metric === metric && data?.scope === scope ? data?.payload : null

  const coverageBadge = !current || current.scope === 'official' || current.fullBoxScoreGames === current.gamesWithBoxScores
    ? 'Full box scores'
    : current.fullBoxScoreGames > 0 ? 'Full box scores and selected scorers' : 'Selected scorers'

  return (
    <Panel className="stat-leaders-panel">
      <div className="section-heading"><h2>Stat Leaders</h2></div>
      <div className="box-score-actions" role="group" aria-label="Stat leader metric">
        {metrics.map(([key, label]) => (
          <button key={key} type="button" className="btn secondary small" aria-pressed={metric === key}
            onClick={() => setMetric(key)}>{label}</button>
        ))}
      </div>
      {data && data.payload.fullBoxScoreGames > 0 && data.payload.fullBoxScoreGames < data.payload.gamesWithBoxScores && (
        <label className="box-score-field">Box score scope
          <select value={scope ?? data.payload.scope} onChange={(event) => setScope(event.target.value as LeaderScope)}>
            <option value="official">Full box scores only</option>
            <option value="all">All published box scores</option>
          </select>
        </label>
      )}
      {error ? <p role="alert">Could not load stat leaders. <button className="btn secondary small" type="button" onClick={() => void reload()}>Retry</button></p>
        : loading || !current ? <LoadingState label="Loading stat leaders" /> : (
          <>
            <div className="box-score-actions">
              <span className="box-score-badge">{coverageBadge}</span>
              {current.isPartialCoverage && <p className="muted">{current.coverageLabel}</p>}
            </div>
            {current.leaders.length ? (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Stat leader rankings">
                <table className="data-table" aria-label={`${metrics.find(([key]) => key === metric)?.[1]} leaders`}>
                  <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Games recorded</th>
                    <th scope="col">Total</th><th scope="col">Per game</th></tr></thead>
                  <tbody>{current.leaders.map((line) => (
                    <tr key={line.rosterEntryId}><td>{line.rank}</td>
                      <th scope="row">{line.jerseyNumber && `#${line.jerseyNumber} `}{line.playerName}
                        <small><Link to={`/teams/${line.teamId}`}>{line.teamName}</Link>{line.division && ` · ${line.division}`}</small></th>
                      <td>{line.gamesRecorded}</td><td>{line.total}</td><td>{line.average}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="muted">This stat has no recorded player lines in the selected games.</p>}
          </>
        )}
    </Panel>
  )
}
