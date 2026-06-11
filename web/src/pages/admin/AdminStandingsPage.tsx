import { useState } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import type { Tournament } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

export function AdminStandingsPage() {
  const [tournamentId, setTournamentId] = useState('')
  const [message, setMessage] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, standings] = await Promise.all([api.adminTournaments(), api.adminStandings(tournamentId || null)])
    return { tournaments: tournaments.tournaments, ...standings }
  }, [tournamentId])

  const recompute = async () => {
    setMessage('')
    try {
      const response = await api.adminRecomputeStandings(tournamentId || null)
      setMessage(`Recomputed ${response.recompute.teams} teams from ${response.recompute.games} games`)
      await reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to recompute standings')
    }
  }

  if (loading && !data) return <LoadingState label="Loading standings" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Standings" description="Review score coverage and run a standings recompute after score edits." actions={<button className="btn primary" onClick={recompute}>Recompute</button>} />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      {message && <Panel className="notice-panel">{message}</Panel>}
      <div className="stats-grid three">
        <StatCard label="Scored" value={data?.scoreCoverage.scoredGames || 0} />
        <StatCard label="Games" value={data?.scoreCoverage.totalGames || 0} />
        <StatCard label="Coverage" value={`${data?.scoreCoverage.percent || 0}%`} tone="gold" />
      </div>
      <Panel>
        {!data?.standings.length ? <EmptyState title="No standings yet" /> : (
          <div className="table-wrap">
            <table className="data-table"><thead><tr><th>Team</th><th>Division</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>{data.standings.map((standing) => <tr key={standing.id}><td><strong>{standing.team.displayName}</strong><small>{standing.team.classYearLabel}</small></td><td>{standing.team.division || 'Unassigned'}</td><td>{standing.wins}</td><td>{standing.losses}</td><td>{standing.pointsFor}</td><td>{standing.pointsAgainst}</td><td>{standing.pointDifferential}</td></tr>)}</tbody></table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Active or latest</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}
