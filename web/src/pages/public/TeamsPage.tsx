import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, LoadingState, Panel, SectionUnavailable } from '../../components/ui'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'

export function TeamsPage() {
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [division, setDivision] = useState('')
  const tournamentId = params.get('tournamentId')
  const yearParam = params.get('year')
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null
  const { data, loading, error, reload } = useAsync(() => api.publicTeams({ tournamentId, year }), [tournamentId, year])
  const term = search.trim().toLowerCase()
  const teams = data?.teams.filter((team) => (!division || team.division === division) &&
    [team.displayName, team.classYearLabel].some((label) => label.toLowerCase().includes(term))) || []

  return (
    <div className="page-stack">
      <h1>{data?.tournament ? `${data.tournament.year} Teams & Rosters` : 'Teams & Rosters'}</h1>
      {loading && !data && <LoadingState label="Loading teams" />}
      {error && <SectionUnavailable title="Teams are temporarily unavailable" onRetry={reload} />}
      {!loading && !error && !data?.schedulePublished && <EmptyState title="The schedule hasn’t been published yet" description="Teams and rosters will appear here when the schedule is published." action={<Link to="/history">Explore past tournaments</Link>} />}
      {data?.schedulePublished && (
        <Panel>
          <div className="season-fields">
            <label>Search teams<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <label>Division<select value={division} onChange={(event) => setDivision(event.target.value)}><option value="">All divisions</option>{data.divisions.map((name) => <option key={name}>{name}</option>)}</select></label>
          </div>
          {teams.length === 0 && <EmptyState title="No matching teams" />}
          <ul className="compact-list season-team-list">
            {teams.map((team) => <li className="compact-row" key={team.id}>
              <Link to={`/teams/${team.id}`}><strong>{team.displayName}</strong></Link>
              <span>{team.division}</span>
              {team.classCohorts.map((cohort) => <Link key={cohort.id} to={`/classes/${cohort.routeKey}`}>{cohort.displayName}</Link>)}
            </li>)}
          </ul>
        </Panel>
      )}
    </div>
  )
}
