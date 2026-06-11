import { useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

export function AdminDivisionsPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams] = await Promise.all([api.adminTournaments(), api.adminTeams(tournamentId || null)])
    return { tournaments: tournaments.tournaments, teams: teams.teams }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading teams" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Divisions and teams" description="Maintain class labels, display names, and division assignment." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <CreateTeamPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Teams</h2><span>{data?.teams.length || 0}</span></div>
        {!data?.teams.length ? <EmptyState title="No teams found" /> : <div className="admin-list">{data.teams.map((team) => <EditableTeam key={team.id} team={team} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateTeamPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ tournamentId: selectedTournamentId || tournaments[0]?.id || '', classYearLabel: '', displayName: '', division: '' })
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.adminCreateTeam(form)
      setForm({ ...form, classYearLabel: '', displayName: '' })
      setMessage('Team created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create team')
    }
  }

  return <Panel><div className="section-heading"><h2>Add team</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><FormGrid><Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} placeholder="Class of 2016/17" required /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="2016/17" required /></Field><Field label="Division"><input value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} placeholder="Maroon" /></Field></FormGrid><button className="btn primary" type="submit">Create team</button></form></Panel>
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

  return <article className="admin-row-card"><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field><Field label="Division"><input value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} /></Field></FormGrid>{saveError && <p className="form-error" role="alert">{saveError}</p>}<button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save team'}</button></article>
}
