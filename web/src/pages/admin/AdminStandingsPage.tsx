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
      setMessage(`Recomputed ${response.recompute.teams} teams from ${response.recompute.games} final scored pool games`)
      await reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to recompute standings')
    }
  }

  if (loading && !data) return <LoadingState label="Loading standings" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)
  const scoredPoolGames = data?.scoreCoverage.scoredPoolGames ?? data?.scoreCoverage.scoredGames ?? 0
  const totalPoolGames = data?.scoreCoverage.totalPoolGames ?? data?.scoreCoverage.totalGames ?? 0
  const divisionGroups = data?.divisionStandings || []

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Standings"
        description="Pool standings update when final scores are saved on the Games page. Use recompute as a safety refresh after a score cleanup pass."
        actions={<><button className="btn primary" onClick={recompute}>Recompute</button>{tournament && <Link className="btn secondary" to={tournamentScopedPath('/admin/games', tournament.id)}>Enter scores</Link>}</>}
      />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      {message && <Panel className="notice-panel">{message}</Panel>}
      <div className="stats-grid three">
        <StatCard label="Scored pool games" value={scoredPoolGames} />
        <StatCard label="Pool games" value={totalPoolGames} />
        <StatCard label="Pool score coverage" value={`${data?.scoreCoverage.percent || 0}%`} tone="gold" />
      </div>
      {!data?.standings.length ? (
        <Panel>
          <EmptyState title="No standings yet" description="Assign teams to standings-eligible divisions and enter final pool scores on the Games page." />
        </Panel>
      ) : divisionGroups.length > 0 ? (
        divisionGroups.map((group) => {
          const headingId = `admin-standings-division-${group.division.id}`
          return (
            <Panel key={group.division.id}>
              <div className="section-heading">
                <div>
                  <h2 id={headingId}>{group.division.name} Division</h2>
                  <p className="muted">
                    Pool score coverage: {group.scoreCoverage.scoredPoolGames ?? group.scoreCoverage.scoredGames} of {group.scoreCoverage.totalPoolGames ?? group.scoreCoverage.totalGames} ({group.scoreCoverage.percent}%)
                  </p>
                </div>
                <span>{group.standings.length} teams</span>
              </div>
              {!group.standings.length ? (
                <EmptyState title={`No ${group.division.name} teams ranked`} description="Assign teams to this division to rank them here." />
              ) : (
                <div className="table-wrap">
                  <table className="data-table" aria-labelledby={headingId}>
                    <thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
                    <tbody>
                      {group.standings.map((standing, index) => (
                        <tr key={standing.id}>
                          <td>{standing.rank ?? index + 1}</td>
                          <td><strong>{standing.team.displayName}</strong><small>{standing.team.classYearLabel}</small></td>
                          <td>{standing.wins}</td>
                          <td>{standing.losses}</td>
                          <td>{standing.pointsFor}</td>
                          <td>{standing.pointsAgainst}</td>
                          <td>{standing.pointDifferential > 0 ? `+${standing.pointDifferential}` : standing.pointDifferential}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )
        })
      ) : (
        <Panel>
          <div className="table-wrap">
            <table className="data-table" aria-label="Division standings"><thead><tr><th>Rank</th><th>Team</th><th>Division</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>{data.standings.map((standing, index) => <tr key={standing.id}><td>{standing.rank ?? index + 1}</td><td><strong>{standing.team.displayName}</strong><small>{standing.team.classYearLabel}</small></td><td>{standing.team.division || 'Unassigned'}</td><td>{standing.wins}</td><td>{standing.losses}</td><td>{standing.pointsFor}</td><td>{standing.pointsAgainst}</td><td>{standing.pointDifferential}</td></tr>)}</tbody></table>
          </div>
        </Panel>
      )}
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}
