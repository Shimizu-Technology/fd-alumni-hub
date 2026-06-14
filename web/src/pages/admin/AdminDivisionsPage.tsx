import { Link } from 'react-router-dom'
import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { divisionOptions } from '../../lib/games'
import type { Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

export function AdminDivisionsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams] = await Promise.all([api.adminTournaments(), api.adminTeams(tournamentId || null)])
    return { tournaments: tournaments.tournaments, teams: teams.teams }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading teams" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId)
  const teams = data?.teams || []
  const divisions = divisionOptions(teams)

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Teams and divisions"
        description="Create the class teams for this tournament, including combined classes, and assign each team to Maroon, Gold, Platinum, Diamond, or another division."
        actions={tournament && <Link className="btn primary" to={tournamentScopedPath('/admin/games', tournament.id)}>Build schedule</Link>}
      />
      <TournamentFilter tournaments={tournaments} value={tournament?.id || ''} onChange={setTournamentId} />
      <datalist id="division-options">{divisions.map((division) => <option key={division} value={division} />)}</datalist>
      <Panel className="notice-panel">Known divisions: {divisions.join(', ')}</Panel>
      <CreateTeamPanel tournament={tournament} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Teams</h2><span>{teams.length}</span></div>
        {!teams.length ? <EmptyState title="No teams found" description="Add the teams that are playing in this tournament before building the schedule." /> : <div className="admin-list">{teams.map((team) => <EditableTeam key={team.id} team={team} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateTeamPanel({ tournament, onSaved }: { tournament: Tournament | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ classYearLabel: '', displayName: '', division: 'Maroon' })
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!tournament) {
      setMessage('Select a tournament before creating a team')
      return
    }

    try {
      await api.adminCreateTeam({ ...form, tournamentId: tournament.id })
      setForm({ classYearLabel: '', displayName: '', division: form.division })
      setMessage('Team created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create team')
    }
  }

  return <Panel><div className="section-heading"><h2>Add team</h2>{message && <span>{message}</span>}</div>{!tournament ? <EmptyState title="Choose a tournament first" /> : <form onSubmit={submit}><p className="form-note">Tournament: {tournament.year}</p><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} placeholder="Class of 2016/17" required /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="2016/17" required /></Field><Field label="Division"><input list="division-options" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} placeholder="Maroon" /></Field></FormGrid><button className="btn primary" type="submit">Create team</button></form>}</Panel>
}

function EditableTeam({ team, onSaved }: { team: Team; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ classYearLabel: team.classYearLabel, displayName: team.displayName, division: team.division || '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateTeam(team.id, form)
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save team'))
    } finally {
      setSaving(false)
    }
  }

  return <article className="admin-row-card"><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field><Field label="Division"><input list="division-options" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} /></Field></FormGrid>{saveError && <p className="form-error" role="alert">{saveError}</p>}<button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save team'}</button></article>
}
