import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { representedClassesLabel } from '../../lib/classes'
import { useAsync } from '../../lib/hooks'
import { numericSearchParam } from '../../lib/urls'
import type { DivisionStandingsGroup, Standing } from '../../lib/types'
import { EmptyState, LoadingState, PageHeader, Panel, SectionUnavailable, StatCard } from '../../components/ui'

export function StandingsPage() {
  const [year] = useState(() => numericSearchParam('year'))
  const [division, setDivision] = useState('')
  const [teamId, setTeamId] = useState(() => new URLSearchParams(window.location.search).get('teamId') || '')
  const queryKey = JSON.stringify({ year, division })
  const { data: rawData, loading, error, reload } = useAsync(async () => ({
    queryKey,
    payload: await api.publicStandings({ year, division }),
  }), [queryKey])

  const data = rawData?.queryKey === queryKey ? rawData.payload : null
  const filterOptions = rawData?.payload || null
  const filteredStandings = useMemo(() => {
    const standings = data?.standings || []
    return teamId ? standings.filter((standing) => standing.team.id === teamId) : standings
  }, [data?.standings, teamId])

  const divisionGroups = useMemo<DivisionStandingsGroup[]>(() => {
    const groups = data?.divisionStandings || []
    if (!groups.length) return []

    return groups
      .map((group) => ({
        ...group,
        standings: teamId ? group.standings.filter((standing) => standing.team.id === teamId) : group.standings,
      }))
      .filter((group) => !teamId || group.standings.length > 0)
  }, [data?.divisionStandings, teamId])

  const scoredPoolGames = data?.scoreCoverage.scoredPoolGames ?? data?.scoreCoverage.scoredGames ?? 0
  const totalPoolGames = data?.scoreCoverage.totalPoolGames ?? data?.scoreCoverage.totalGames ?? 0

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={filterOptions?.tournament ? `${filterOptions.tournament.year} standings` : 'Standings'}
        title="Division standings"
        description="Pool play records update from final scores entered by tournament staff. Rankings reset at #1 inside each division."
      />

      {filterOptions && (
        <Panel className="toolbar-panel standings-filter-panel">
          <label><span>Team entry</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">All team entries</option>{filterOptions.standings.map((standing) => <option key={standing.team.id} value={standing.team.id}>{standing.team.displayName}</option>)}</select></label>
          <label><span>Division</span><select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{filterOptions.divisions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          {(teamId || division) && <button className="btn secondary" type="button" onClick={() => { setTeamId(''); setDivision('') }}>Clear filters</button>}
        </Panel>
      )}

      {loading && !data ? (
        <LoadingState label="Loading standings" />
      ) : error && !data ? (
        <SectionUnavailable
          title="Standings are temporarily unavailable"
          description="Could not load division standings from the API right now."
          onRetry={reload}
          action={<Link className="btn secondary" to="/history">Browse champion history</Link>}
        />
      ) : (
        <>
          {error && (
            <Panel className="notice-panel">
              <span>Could not refresh standings — showing last loaded records.</span>{' '}
              <button type="button" className="btn secondary small" onClick={() => void reload()}>Retry</button>
            </Panel>
          )}
          <div className="stats-grid three">
            <StatCard label="Scored pool games" value={scoredPoolGames} tone="maroon" />
            <StatCard label="Pool games" value={totalPoolGames} />
            <StatCard label="Pool score coverage" value={`${data?.scoreCoverage.percent || 0}%`} tone="gold" />
          </div>

          {!data?.standings.length ? (
            <EmptyState title="No standings yet" description="Standings appear after pool games have final scores and the recompute job has run." />
          ) : !filteredStandings.length ? (
            <EmptyState title="No standings match this filter" description="Clear filters to see more classes." />
          ) : divisionGroups.length > 0 ? (
            divisionGroups.map((group) => (
              <Panel className="standings-panel" key={group.division.id}>
                <div className="section-heading">
                  <div>
                    <h2>{group.division.name} Division</h2>
                    <p className="muted">
                      Pool score coverage: {group.scoreCoverage.scoredPoolGames ?? group.scoreCoverage.scoredGames} of {group.scoreCoverage.totalPoolGames ?? group.scoreCoverage.totalGames} ({group.scoreCoverage.percent}%)
                    </p>
                  </div>
                  <span>{group.standings.length} {group.standings.length === 1 ? 'team' : 'teams'}</span>
                </div>
                {group.standings.length === 0 ? (
                  <EmptyState title={`No ${group.division.name} standings yet`} description="Assign teams to this division and enter final pool scores." />
                ) : (
                  <StandingsList standings={group.standings} showDivisionColumn={false} />
                )}
              </Panel>
            ))
          ) : (
            <Panel className="standings-panel">
              <StandingsList standings={filteredStandings} showDivisionColumn />
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

function StandingsList({ standings, showDivisionColumn }: { standings: Standing[]; showDivisionColumn: boolean }) {
  return (
    <>
      <div className="standings-mobile-list" aria-label="Mobile standings list">
        {standings.map((standing, index) => (
          <article className="standing-mobile-card" key={standing.id}>
            <div>
              <span>#{standing.rank ?? index + 1}</span>
              <strong><Link to={`/teams/${standing.team.id}`}>{standing.team.displayName}</Link></strong>
              <small>{standing.team.division || 'Division pending'} · {representedClassesLabel(standing.team)}</small>
            </div>
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
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              {showDivisionColumn && <th>Division</th>}
              <th>W</th>
              <th>L</th>
              <th>PF</th>
              <th>PA</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing, index) => (
              <tr key={standing.id}>
                <td>{standing.rank ?? index + 1}</td>
                <td><strong><Link to={`/teams/${standing.team.id}`}>{standing.team.displayName}</Link></strong><small>{representedClassesLabel(standing.team)}</small></td>
                {showDivisionColumn && <td>{standing.team.division || 'Unassigned'}</td>}
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
    </>
  )
}
