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
type TeamSortOption = 'display' | 'class' | 'division' | 'roster'

export function AdminDivisionsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [teamQuery, setTeamQuery] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [teamSort, setTeamSort] = useState<TeamSortOption>('display')
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

  const tournaments = data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId)
  const teams = data?.teams || []
  const divisions = data?.divisions || []
  const allDivisions = data?.allDivisions || []
  const divisionOptions = useMemo(() => availableDivisionOptions(teams, divisions), [teams, divisions])
  const visibleTeams = useMemo(() => filterAndSortTeams(teams, teamQuery, divisionFilter, teamSort), [teams, teamQuery, divisionFilter, teamSort])

  if (loading && !data) return <LoadingState label="Loading teams" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Teams and divisions"
        description="Configure divisions, keep the team list clean, and manage optional public rosters without leaving the tournament workspace."
        actions={tournament && <Link className="btn primary" to={tournamentScopedPath('/admin/games', tournament.id)}>Build schedule</Link>}
      />
      <TournamentFilter tournaments={tournaments} value={tournament?.id || ''} onChange={setTournamentId} />
      <DivisionSettingsPanel tournament={tournament} divisions={divisions} allDivisions={allDivisions} onSaved={reload} />
      <CreateTeamPanel tournament={tournament} divisions={divisions} onSaved={reload} />
      <Panel>
        <div className="section-heading">
          <div>
            <h2>Teams</h2>
            <p className="muted">Cards are read-only until you choose to edit, so accidental changes are harder to make.</p>
          </div>
          <span>{visibleTeams.length} of {teams.length}</span>
        </div>
        <TeamToolbar
          query={teamQuery}
          division={divisionFilter}
          sort={teamSort}
          divisions={divisionOptions}
          onQueryChange={setTeamQuery}
          onDivisionChange={setDivisionFilter}
          onSortChange={setTeamSort}
        />
        {!teams.length ? <EmptyState title="No teams found" description="Add the teams that are playing in this tournament before building the schedule." /> : null}
        {teams.length > 0 && !visibleTeams.length ? <EmptyState title="No teams match those filters" description="Clear the search or division filter to see more teams." /> : null}
        {visibleTeams.length > 0 && <div className="admin-list team-card-list">{visibleTeams.map((team) => <EditableTeam key={team.id} team={team} divisions={divisions} onSaved={reload} />)}</div>}
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
  const [saving, setSaving] = useState(false)

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

    setSaving(true)
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
    } finally {
      setSaving(false)
    }
  }

  return <Panel><div className="section-heading"><h2>Add team</h2>{message && <span>{message}</span>}</div>{!tournament ? <EmptyState title="Choose a tournament first" /> : <form onSubmit={submit}><p className="form-note">Tournament: {tournament.year}</p><FormGrid><Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} placeholder="Class of 2016/17" required /></Field><Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="2016/17" required /></Field><Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} onChange={(divisionId) => setForm({ ...form, divisionId })} required /></Field></FormGrid><button className="btn primary" type="submit" disabled={!divisions.length || saving}>{saving ? 'Creating' : 'Create team'}</button></form>}</Panel>
}

function TeamToolbar({ query, division, sort, divisions, onQueryChange, onDivisionChange, onSortChange }: { query: string; division: string; sort: TeamSortOption; divisions: string[]; onQueryChange: (value: string) => void; onDivisionChange: (value: string) => void; onSortChange: (value: TeamSortOption) => void }) {
  return (
    <div className="team-toolbar toolbar-panel">
      <label><span>Search teams</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Class year, display name, division" /></label>
      <label><span>Division</span><select value={division} onChange={(event) => onDivisionChange(event.target.value)}><option value="">All divisions</option>{divisions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as TeamSortOption)}><option value="display">Display name</option><option value="class">Class label</option><option value="division">Division</option><option value="roster">Roster size</option></select></label>
    </div>
  )
}

function EditableTeam({ team, divisions, onSaved }: { team: Team; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(teamFormState(team, divisions))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const rosterCount = team.rosterEntries?.length || 0

  useEffect(() => {
    if (!editing) setForm(teamFormState(team, divisions))
  }, [team, divisions, editing])

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateTeam(team.id, { classYearLabel: form.classYearLabel, displayName: form.displayName, ...divisionPayload(form.divisionId, divisions) }, team.tournamentId)
      setEditing(false)
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save team'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${team.displayName}? Teams with games cannot be deleted.`)) return

    setSaving(true)
    setSaveError('')
    try {
      await api.adminDeleteTeam(team.id, team.tournamentId)
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to remove team. If this team has games, remove or reassign those games first.'))
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setForm(teamFormState(team, divisions))
    setSaveError('')
    setEditing(false)
  }

  return (
    <article className="admin-row-card team-admin-card team-summary-card">
      <div className="team-card-header">
        <div>
          <span className="team-card-kicker">{team.division || 'No division'}</span>
          <h3>{team.displayName}</h3>
          <p>{team.classYearLabel} · {rosterCount} roster {rosterCount === 1 ? 'player' : 'players'}</p>
        </div>
        <div className="row-actions">
          {!editing && <button className="btn secondary small" type="button" onClick={() => setEditing(true)}>Edit team</button>}
          {!editing && <button className="btn danger small" type="button" onClick={remove} disabled={saving}>{saving ? 'Removing' : 'Delete'}</button>}
        </div>
      </div>

      {editing ? (
        <div className="team-edit-panel">
          <FormGrid>
            <Field label="Class label"><input value={form.classYearLabel} onChange={(event) => setForm({ ...form, classYearLabel: event.target.value })} /></Field>
            <Field label="Display name"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></Field>
            <Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} currentName={team.division} onChange={(divisionId) => setForm({ ...form, divisionId })} /></Field>
          </FormGrid>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="row-actions">
            <button className="btn secondary small" type="button" onClick={cancel} disabled={saving}>Cancel</button>
            <button className="btn primary small" type="button" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save team'}</button>
            <button className="btn danger small" type="button" onClick={remove} disabled={saving}>{saving ? 'Removing' : 'Delete team'}</button>
          </div>
        </div>
      ) : (
        <div className="team-facts-grid">
          <div><span>Class label</span><strong>{team.classYearLabel}</strong></div>
          <div><span>Display name</span><strong>{team.displayName}</strong></div>
          <div><span>Division</span><strong>{team.division || 'Not assigned'}</strong></div>
        </div>
      )}
      {!editing && saveError && <p className="form-error" role="alert">{saveError}</p>}
      <RosterEditor team={team} entries={team.rosterEntries || []} onSaved={onSaved} />
    </article>
  )
}

function RosterEditor({ team, entries, onSaved }: { team: Team; entries: RosterEntry[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [editingEntry, setEditingEntry] = useState<RosterEntry | null>(null)
  const [adding, setAdding] = useState(false)

  const closeModal = () => {
    setEditingEntry(null)
    setAdding(false)
  }

  return (
    <div className="roster-admin-panel">
      <div className="section-heading compact-heading">
        <div><h3>Roster</h3><p className="muted">Optional public roster for {team.displayName}.</p></div>
        <button className="btn secondary small" type="button" onClick={() => setOpen((value) => !value)}>{open ? 'Hide roster' : `Manage roster (${entries.length})`}</button>
      </div>
      {message && <p className="form-note">{message}</p>}
      {open && (
        <div className="collapsible-body roster-manager-body">
          <div className="row-actions"><button className="btn secondary small" type="button" onClick={() => setAdding(true)}>Add player</button></div>
          {entries.length ? <RosterTable entries={entries} onEdit={setEditingEntry} /> : <EmptyState title="Roster empty" description="Add players if organizers provide roster details." />}
        </div>
      )}
      {(adding || editingEntry) && (
        <RosterEntryModal
          team={team}
          entry={editingEntry}
          nextSortOrder={entries.length + 1}
          onClose={closeModal}
          onSaved={async (action) => {
            setMessage(action)
            closeModal()
            await onSaved()
          }}
        />
      )}
    </div>
  )
}

function RosterTable({ entries, onEdit }: { entries: RosterEntry[]; onEdit: (entry: RosterEntry) => void }) {
  return (
    <div className="roster-table-wrap" role="region" aria-label="Roster entries" tabIndex={0}>
      <table className="data-table roster-admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Jersey #</th>
            <th>Position</th>
            <th>Nickname</th>
            <th>Public</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td><strong>{entry.name}</strong></td>
              <td>{entry.jerseyNumber || '—'}</td>
              <td>{entry.position || '—'}</td>
              <td>{entry.nickname || '—'}</td>
              <td>{entry.active ? 'Yes' : 'Hidden'}</td>
              <td><button className="btn secondary small" type="button" onClick={() => onEdit(entry)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RosterEntryModal({ team, entry, nextSortOrder, onClose, onSaved }: { team: Team; entry: RosterEntry | null; nextSortOrder: number; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [form, setForm] = useState({ name: entry?.name || '', jerseyNumber: entry?.jerseyNumber || '', position: entry?.position || '', nickname: entry?.nickname || '', sortOrder: String(entry?.sortOrder ?? nextSortOrder), active: entry?.active ?? true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editing = Boolean(entry)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { name: form.name, jerseyNumber: form.jerseyNumber, position: form.position, nickname: form.nickname, sortOrder: Number(form.sortOrder || 0), active: form.active }
      if (entry) {
        await api.adminUpdateRosterEntry(entry.id, payload, team.tournamentId)
        await onSaved('Roster player saved')
      } else {
        await api.adminCreateRosterEntry({ teamId: team.id, ...payload }, team.tournamentId)
        await onSaved('Roster player added')
      }
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save roster player'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!entry || !window.confirm(`Remove ${entry.name} from ${team.displayName}?`)) return

    setSaving(true)
    setError('')
    try {
      await api.adminDeleteRosterEntry(entry.id, team.tournamentId)
      await onSaved('Roster player removed')
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to remove roster player'))
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card roster-modal" role="dialog" aria-modal="true" aria-label={editing ? `Edit ${entry?.name}` : `Add player to ${team.displayName}`}>
        <div className="section-heading compact-heading">
          <div>
            <h2>{editing ? 'Edit roster player' : 'Add roster player'}</h2>
            <p className="muted">{team.displayName}</p>
          </div>
          <button className="btn secondary small" type="button" onClick={onClose} disabled={saving}>Close</button>
        </div>
        <form onSubmit={save}>
          <FormGrid>
            <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Player name" required /></Field>
            <Field label="Jersey #"><input value={form.jerseyNumber} onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value })} /></Field>
            <Field label="Position"><input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="G / F / C" /></Field>
            <Field label="Nickname"><input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></Field>
            <Field label="Sort order"><input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
            <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Public</label>
          </FormGrid>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving' : editing ? 'Save player' : 'Add player'}</button>
            {entry && <button className="btn danger" type="button" onClick={remove} disabled={saving}>Remove player</button>}
          </div>
        </form>
      </div>
    </div>
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

function teamFormState(team: Team, divisions: Division[]) {
  return { classYearLabel: team.classYearLabel, displayName: team.displayName, divisionId: divisionValueFor(team, divisions) }
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

function availableDivisionOptions(teams: Team[], divisions: Division[]) {
  const names = new Set<string>()
  divisions.forEach((division) => names.add(division.name))
  teams.forEach((team) => {
    if (team.division) names.add(team.division)
  })
  return Array.from(names).sort((a, b) => a.localeCompare(b))
}

function filterAndSortTeams(teams: Team[], query: string, division: string, sort: TeamSortOption) {
  const normalizedQuery = query.trim().toLowerCase()
  return teams
    .filter((team) => {
      const matchesQuery = !normalizedQuery || [ team.classYearLabel, team.displayName, team.division || '' ].join(' ').toLowerCase().includes(normalizedQuery)
      const matchesDivision = !division || team.division === division
      return matchesQuery && matchesDivision
    })
    .slice()
    .sort((a, b) => compareTeams(a, b, sort))
}

function compareTeams(a: Team, b: Team, sort: TeamSortOption) {
  if (sort === 'class') return a.classYearLabel.localeCompare(b.classYearLabel, undefined, { numeric: true })
  if (sort === 'division') return `${a.division || ''} ${a.displayName}`.localeCompare(`${b.division || ''} ${b.displayName}`, undefined, { numeric: true })
  if (sort === 'roster') return (b.rosterEntries?.length || 0) - (a.rosterEntries?.length || 0) || a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
  return a.displayName.localeCompare(b.displayName, undefined, { numeric: true })
}
