import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import type { Tournament } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

export function AdminStandingsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [message, setMessage] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, standings] = await Promise.all([api.adminTournaments(), api.adminStandings(tournamentId || null)])
    return { tournaments: tournaments.tournaments, ...standings }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  const recompute = async () => {
    setMessage('')
    try {
      const response = await api.adminRecomputeStandings(tournamentId || null)
      setMessage(`Recomputed ${response.recompute.teams} teams from ${response.recompute.games} final scored games`)
      await reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to recompute standings')
    }
  }

  if (loading && !data) return <LoadingState label="Loading standings" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Standings"
        description="Standings update when final scores are saved on the Games page. Use recompute as a safety refresh after a score cleanup pass."
        actions={<><button className="btn primary" onClick={recompute}>Recompute</button>{tournament && <Link className="btn secondary" to={tournamentScopedPath('/admin/games', tournament.id)}>Enter scores</Link>}</>}
      />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      {message && <Panel className="notice-panel">{message}</Panel>}
      <div className="stats-grid three">
        <StatCard label="Scored" value={data?.scoreCoverage.scoredGames || 0} />
        <StatCard label="Games" value={data?.scoreCoverage.totalGames || 0} />
        <StatCard label="Coverage" value={`${data?.scoreCoverage.percent || 0}%`} tone="gold" />
      </div>
      <Panel>
        {!data?.standings.length ? <EmptyState title="No standings yet" description="Enter final scores on the Games page, then standings will appear here." /> : (
          <div className="table-wrap">
            <table className="data-table"><thead><tr><th>Team</th><th>Division</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>{data.standings.map((standing) => <tr key={standing.id}><td><strong>{standing.team.displayName}</strong><small>{standing.team.classYearLabel}</small></td><td>{standing.team.division || 'Unassigned'}</td><td>{standing.wins}</td><td>{standing.losses}</td><td>{standing.pointsFor}</td><td>{standing.pointsAgainst}</td><td>{standing.pointDifferential}</td></tr>)}</tbody></table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}
