import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { divisionNameById } from '../../lib/games'
import type { Division, RosterEntry, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const legacyPrefix = 'legacy:'

export function AdminDivisionsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams, divisions] = await Promise.all([
      api.adminTournaments(),
      api.adminTeams(tournamentId || null),
      api.adminDivisions(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, teams: teams.teams, divisions: divisions.divisions, allDivisions: divisions.allDivisions }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading teams" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId)
  const teams = data?.teams || []
  const divisions = data?.divisions || []
  const allDivisions = data?.allDivisions || []

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Teams and divisions"
        description="Configure the division list once, then assign each tournament team from a dropdown. New divisions can start with the selected tournament year so older tournaments keep their original setup."
        actions={tournament && <Link className="btn primary" to={tournamentScopedPath('/admin/games', tournament.id)}>Build schedule</Link>}
      />
      <TournamentFilter tournaments={tournaments} value={tournament?.id || ''} onChange={setTournamentId} />
      <DivisionSettingsPanel tournament={tournament} divisions={divisions} allDivisions={allDivisions} onSaved={reload} />
      <CreateTeamPanel tournament={tournament} divisions={divisions} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Teams</h2><span>{teams.length}</span></div>
        {!teams.length ? <EmptyState title="No teams found" description="Add the teams that are playing in this tournament before building the schedule." /> : <div className="admin-list">{teams.map((team) => <EditableTeam key={team.id} team={team} divisions={divisions} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function DivisionSettingsPanel({ tournament, divisions, allDivisions, onSaved }: { tournament: Tournament | null; divisions: Division[]; allDivisions: Division[]; onSaved: () => Promise<void> }) {
  const nextPosition = useMemo(() => Math.max(0, ...allDivisions.map((division) => division.position)) + 1, [allDivisions])
  const [form, setForm] = useState({ name: '', startsYear: '', position: '1' })
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saveError, setSaveError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setForm((current) => ({ ...current, startsYear: tournament ? String(tournament.year) : '', position: String(nextPosition) }))
  }, [nextPosition, tournament?.year])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaveSuccess('')
    setSaveError('')
    if (!tournament) {
      setSaveError('Select a tournament before adding a division')
      return
    }

    try {
      await api.adminCreateDivision({
        name: form.name,
        startsYear: form.startsYear ? Number(form.startsYear) : null,
        position: Number(form.position || nextPosition),
        active: true,
      })
      setForm((current) => ({ ...current, name: '', position: String(nextPosition + 1) }))
      setSaveSuccess('Division added')
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to add division'))
    }
  }

  return (
    <Panel className="collapsible-panel">
      <div className="section-heading collapsible-heading">
        <div>
          <h2>Division settings</h2>
          <p>Rarely changed. Current tournament divisions are shown below.</p>
        </div>
        <button className="btn secondary small" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? 'Hide settings' : 'Edit settings'}
        </button>
      </div>
      <div className="division-pill-list" aria-label="Available divisions for selected tournament">
        {divisions.map((division) => <span key={division.id}>{division.name}</span>)}
      </div>
      {saveSuccess && <p className="form-note" role="status">{saveSuccess}</p>}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      {open && (
        <div className="collapsible-body">
          <form onSubmit={submit} className="stacked-form">
            <p className="form-note">Adding a new division defaults to {tournament ? `${tournament.year} and future tournaments` : 'the selected tournament year'}. Renaming a division updates teams and games assigned to that division; create a new division for future-only changes.</p>
            <FormGrid>
              <Field label="Division name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Diamond" required /></Field>
              <Field label="Starting year"><input type="number" value={form.startsYear} onChange={(event) => setForm({ ...form, startsYear: event.target.value })} placeholder="All years if blank" /></Field>
              <Field label="Display order"><input type="number" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field>
            </FormGrid>
            <button className="btn secondary" type="submit">Add division</button>
          </form>
          {allDivisions.length > 0 && <div className="admin-list compact-admin-list">{allDivisions.map((division) => <EditableDivision key={division.id} division={division} onSaved={onSaved} />)}</div>}
        </div>
      )}
    </Panel>
  )
}

function EditableDivision({ division, onSaved }: { division: Division; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ name: division.name, startsYear: division.startsYear?.toString() || '', position: String(division.position), active: division.active })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateDivision(division.id, {
        name: form.name,
        startsYear: form.startsYear ? Number(form.startsYear) : null,
        position: Number(form.position || 0),
        active: form.active,
      })
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save division'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="admin-row-card compact-admin-row">
      <FormGrid>
        <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
        <Field label="Starting year"><input type="number" value={form.startsYear} onChange={(event) => setForm({ ...form, startsYear: event.target.value })} placeholder="All years" /></Field>
        <Field label="Order"><input type="number" value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field>
      </FormGrid>
      <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active</label>
      <StatusBadge status={division.available ? 'available' : 'future'} />
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <button className="btn secondary small" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save division'}</button>
    </article>
  )
}

function CreateTeamPanel({ tournament, divisions, onSaved }: { tournament: Tournament | null; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ classYearLabel: '', displayName: '', divisionId: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm((current) => ({ ...current, divisionId: divisions[0]?.id || '' }))
  }, [divisions])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!tournament) {
      setMessage('Select a tournament before creating a team')
      return
    }

    try {
      await api.adminCreateTeam({
        tournamentId: tournament.id,
        classYearLabel: form.classYearLabel,
        displayName: form.displayName,
        ...divisionPayload(form.divisionId, divisions),
      })
      setForm({ classYearLabel: '', displayName: '', divisionId: divisions[0]?.id || '' })
      setMessage('Team created')
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to create team'))
    }
  }

  return <Panel><div className="section-heading"><h2>Add team</h2>{message && <span>{message}</span>}</div>{!tournament ? <EmptyState title="Choose a tournament first" /> : <form onSubmit={submit}><p className="form-note">Tournament: {tournament.year}</p><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} placeholder="Class of 2016/17" required /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="2016/17" required /></Field><Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} onChange={(divisionId) => setForm({ ...form, divisionId })} required /></Field></FormGrid><button className="btn primary" type="submit" disabled={!divisions.length}>Create team</button></form>}</Panel>
}

function EditableTeam({ team, divisions, onSaved }: { team: Team; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ classYearLabel: team.classYearLabel, displayName: team.displayName, divisionId: divisionValueFor(team, divisions) })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateTeam(team.id, { classYearLabel: form.classYearLabel, displayName: form.displayName, ...divisionPayload(form.divisionId, divisions) })
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save team'))
    } finally {
      setSaving(false)
    }
  }

  return <article className="admin-row-card team-admin-card"><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field><Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} currentName={team.division} onChange={(divisionId) => setForm({ ...form, divisionId })} /></Field></FormGrid>{saveError && <p className="form-error" role="alert">{saveError}</p>}<button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save team'}</button><RosterEditor team={team} entries={team.rosterEntries || []} onSaved={onSaved} /></article>
}

function RosterEditor({ team, entries, onSaved }: { team: Team; entries: RosterEntry[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', jerseyNumber: '', position: '', nickname: '', sortOrder: String(entries.length + 1) })
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm((current) => ({ ...current, sortOrder: String(entries.length + 1) }))
  }, [entries.length])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    try {
      await api.adminCreateRosterEntry({ teamId: team.id, name: form.name, jerseyNumber: form.jerseyNumber, position: form.position, nickname: form.nickname, sortOrder: Number(form.sortOrder || entries.length + 1), active: true })
      setForm({ name: '', jerseyNumber: '', position: '', nickname: '', sortOrder: String(entries.length + 2) })
      setMessage('Roster player added')
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to add roster player'))
    }
  }

  return (
    <div className="roster-admin-panel">
      <div className="section-heading compact-heading">
        <div><h3>Roster</h3><p className="muted">Optional public roster for {team.displayName}.</p></div>
        <button className="btn secondary small" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Hide roster' : `Edit roster (${entries.length})`}</button>
      </div>
      {message && <p className="form-note">{message}</p>}
      {open && (
        <div className="collapsible-body">
          <form onSubmit={submit}>
            <FormGrid>
              <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Player name" required /></Field>
              <Field label="Jersey #"><input value={form.jerseyNumber} onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })} /></Field>
              <Field label="Position"><input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="G / F / C" /></Field>
              <Field label="Nickname"><input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></Field>
              <Field label="Sort order"><input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
            </FormGrid>
            <button className="btn secondary small" type="submit">Add roster player</button>
          </form>
          {entries.length ? <div className="admin-list compact-admin-list">{entries.map((entry) => <EditableRosterEntry key={entry.id} entry={entry} onSaved={onSaved} />)}</div> : <EmptyState title="Roster empty" description="Add players if organizers provide roster details." />}
        </div>
      )}
    </div>
  )
}

function EditableRosterEntry({ entry, onSaved }: { entry: RosterEntry; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ name: entry.name, jerseyNumber: entry.jerseyNumber || '', position: entry.position || '', nickname: entry.nickname || '', sortOrder: String(entry.sortOrder), active: entry.active })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.adminUpdateRosterEntry(entry.id, { name: form.name, jerseyNumber: form.jerseyNumber, position: form.position, nickname: form.nickname, sortOrder: Number(form.sortOrder || 0), active: form.active })
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save roster player'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    setError('')
    try {
      await api.adminDeleteRosterEntry(entry.id)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to remove roster player'))
      setSaving(false)
    }
  }

  return (
    <article className="admin-row-card roster-admin-row">
      <FormGrid>
        <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
        <Field label="Jersey #"><input value={form.jerseyNumber} onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })} /></Field>
        <Field label="Position"><input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></Field>
        <Field label="Nickname"><input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></Field>
        <Field label="Order"><input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
      </FormGrid>
      <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Public</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions"><button className="btn secondary small" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save player'}</button><button className="btn danger small" onClick={remove} disabled={saving}>Remove</button></div>
    </article>
  )
}

function DivisionSelect({ value, divisions, currentName, onChange, required }: { value: string; divisions: Division[]; currentName?: string | null; onChange: (value: string) => void; required?: boolean }) {
  const hasCurrentName = currentName && !divisions.some((division) => division.name === currentName)
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">Select division</option>
      {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
      {hasCurrentName && <option value={`${legacyPrefix}${currentName}`}>{currentName} (not in current division settings)</option>}
    </select>
  )
}

function divisionValueFor(team: Team, divisions: Division[]) {
  if (team.divisionId) return team.divisionId
  const matchingDivision = divisions.find((division) => division.name === team.division)
  if (matchingDivision) return matchingDivision.id
  return team.division ? `${legacyPrefix}${team.division}` : ''
}

function divisionPayload(value: string, divisions: Division[]) {
  if (!value) return { divisionId: null, division: null }
  if (value.startsWith(legacyPrefix)) return { divisionId: null, division: value.slice(legacyPrefix.length) }

  return { divisionId: value, division: divisionNameById(value, divisions) || null }
}
