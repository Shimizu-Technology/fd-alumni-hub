import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

export function StandingsPage() {
  const [division, setDivision] = useState('')
  const [teamId, setTeamId] = useState(() => new URLSearchParams(window.location.search).get('teamId') || '')
  const { data, loading, error, reload } = useAsync(() => api.publicStandings({ division }), [division])
  const filteredStandings = useMemo(() => {
    const standings = data?.standings || []
    return teamId ? standings.filter((standing) => standing.team.id === teamId) : standings
  }, [data?.standings, teamId])

  if (loading && !data) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={data?.tournament ? `${data.tournament.year} standings` : 'Standings'}
        title="Division standings"
        description="Records update from final scores entered by tournament staff. Score coverage shows how much of the schedule has verified results."
      />

      <div className="stats-grid three">
        <StatCard label="Scored games" value={data?.scoreCoverage.scoredGames || 0} tone="maroon" />
        <StatCard label="Total games" value={data?.scoreCoverage.totalGames || 0} />
        <StatCard label="Coverage" value={`${data?.scoreCoverage.percent || 0}%`} tone="gold" />
      </div>

      <Panel className="toolbar-panel standings-filter-panel">
        <label><span>Class</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">All classes</option>{data?.standings.map((standing) => <option key={standing.team.id} value={standing.team.id}>{standing.team.displayName}</option>)}</select></label>
        <label><span>Division</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{data?.divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        {(teamId || division) && <button className="btn secondary" type="button" onClick={() => { setTeamId(''); setDivision('') }}>Clear filters</button>}
      </Panel>

      {!data?.standings.length ? (
        <EmptyState title="No standings yet" description="Standings appear after games have final scores and the recompute job has run." />
      ) : !filteredStandings.length ? (
        <EmptyState title="No standings match this filter" description="Clear filters to see more classes." />
      ) : (
        <Panel className="standings-panel">
          <div className="standings-mobile-list" aria-label="Mobile standings list">
            {filteredStandings.map((standing, index) => (
              <article className="standing-mobile-card" key={standing.id}>
                <div><span>#{index + 1}</span><strong><Link to={`/teams/${standing.team.id}`}>{standing.team.displayName}</Link></strong><small>{standing.team.division || 'Division pending'}</small></div>
                <dl>
                  <div><dt>W</dt><dd>{standing.wins}</dd></div>
                  <div><dt>L</dt><dd>{standing.losses}</dd></div>
                  <div><dt>Diff</dt><dd>{standing.pointDifferential > 0 ? `+${standing.pointDifferential}` : standing.pointDifferential}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="table-wrap">
            <table className="data-table standings-table">
              <thead><tr><th>Rank</th><th>Team</th><th>Division</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
              <tbody>
                {filteredStandings.map((standing, index) => (
                  <tr key={standing.id}>
                    <td>{index + 1}</td>
                    <td><strong><Link to={`/teams/${standing.team.id}`}>{standing.team.displayName}</Link></strong><small>{standing.team.classYearLabel}</small></td>
                    <td>{standing.team.division || 'Unassigned'}</td>
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
        </Panel>
      )}
    </div>
  )
}
