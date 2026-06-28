import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { tournamentScopedPath } from '../../lib/admin'
import { formatTournamentWindow } from '../../lib/games'
import type { Tournament, TournamentStatus } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

type TournamentForm = {
  name: string
  year: string
  startDate: string
  endDate: string
  status: TournamentStatus
}

type TournamentSortOption = 'yearDesc' | 'yearAsc' | 'status' | 'name'

const STATUSES: TournamentStatus[] = ['upcoming', 'live', 'completed', 'cancelled']
const STATUS_ORDER: Record<TournamentStatus, number> = { live: 0, upcoming: 1, completed: 2, cancelled: 3 }

export function AdminTournamentsPage() {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<TournamentSortOption>('yearDesc')
  const { data, loading, error, reload } = useAsync(() => api.adminTournaments(), [])

  if (loading && !data) return <LoadingState label="Loading tournaments" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const visibleTournaments = filterAndSortTournaments(tournaments, query, statusFilter, sort)

  return (
    <div className="page-stack admin-page tournaments-admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Tournament command center"
        description="Pick a tournament, review its operating state, and jump into the right workspace. Completed years are treated as archive records; current years surface setup and game-day tasks."
      />

      <TournamentModeGuide />

      <CreateTournamentPanel tournamentsCount={tournaments.length} onSaved={reload} />

      <Panel>
        <div className="section-heading"><h2>Tournaments</h2><span>{visibleTournaments.length} of {tournaments.length}</span></div>
        <TournamentToolbar query={query} status={statusFilter} sort={sort} onQueryChange={setQuery} onStatusChange={setStatusFilter} onSortChange={setSort} />
        {!tournaments.length ? <EmptyState title="No tournaments found" description="Create the tournament year before adding teams and games." /> : null}
        {tournaments.length > 0 && !visibleTournaments.length ? <EmptyState title="No tournaments match those filters" description="Clear the search or status filter to see more tournament years." /> : null}
        {visibleTournaments.length > 0 && (
          <div className="admin-list tournament-list">
            {visibleTournaments.map((tournament) => <TournamentRow key={tournament.id} tournament={tournament} onSaved={reload} />)}
          </div>
        )}
      </Panel>
    </div>
  )
}

function TournamentModeGuide() {
  return (
    <Panel className="tournament-mode-panel">
      <div className="section-heading"><h2>Tournament workspace model</h2><span>Status-aware</span></div>
      <div className="tournament-mode-grid">
        <div>
          <span>Upcoming / live</span>
          <strong>Operate the event</strong>
          <p>Use setup, scheduling, links, game-day notes, scores, and sponsor workflows.</p>
        </div>
        <div>
          <span>Completed</span>
          <strong>Preserve the archive</strong>
          <p>Review results, standings, coverage, photos, and public history without noisy setup prompts.</p>
        </div>
        <div>
          <span>Cancelled</span>
          <strong>Keep the record clean</strong>
          <p>Maintain the year and public note, but keep operational tasks out of the way.</p>
        </div>
      </div>
    </Panel>
  )
}

function CreateTournamentPanel({ tournamentsCount, onSaved }: { tournamentsCount: number; onSaved: () => Promise<void> }) {
  const defaultYear = useMemo(() => String(new Date().getFullYear()), [])
  const [open, setOpen] = useState(tournamentsCount === 0)
  const [form, setForm] = useState<TournamentForm>({
    name: 'FD Alumni Basketball Tournament',
    year: defaultYear,
    startDate: '',
    endDate: '',
    status: 'upcoming',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (tournamentsCount === 0) setOpen(true)
  }, [tournamentsCount])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      await api.adminCreateTournament(payloadFromForm(form))
      setMessage('Tournament created. Open its dashboard to continue setup.')
      setOpen(false)
      setForm((current) => ({ ...current, year: String(Number(current.year || defaultYear) + 1), startDate: '', endDate: '', status: 'upcoming' }))
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to create tournament'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="collapsible-panel admin-create-panel">
      <div className="section-heading collapsible-heading">
        <div>
          <h2>Create tournament</h2>
          <p>Most years are created once. Keep this closed during normal archive review and operations.</p>
        </div>
        <div className="section-actions">
          {message && <span role="status">{message}</span>}
          <button className="btn secondary small" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? 'Hide create form' : 'Create tournament'}
          </button>
        </div>
      </div>
      {open && (
        <div className="collapsible-body">
          <form onSubmit={submit}>
            <FormGrid>
              <TournamentFields form={form} setForm={setForm} />
            </FormGrid>
            <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Creating' : 'Create tournament'}</button>
          </form>
        </div>
      )}
    </Panel>
  )
}

function TournamentToolbar({ query, status, sort, onQueryChange, onStatusChange, onSortChange }: { query: string; status: string; sort: TournamentSortOption; onQueryChange: (value: string) => void; onStatusChange: (value: string) => void; onSortChange: (value: TournamentSortOption) => void }) {
  return (
    <div className="tournament-toolbar toolbar-panel">
      <label><span>Search tournaments</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Year, name, status" /></label>
      <label><span>Status</span><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">All statuses</option>{STATUSES.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}</select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as TournamentSortOption)}><option value="yearDesc">Year · newest first</option><option value="yearAsc">Year · oldest first</option><option value="status">Status priority</option><option value="name">Name</option></select></label>
    </div>
  )
}

function TournamentRow({ tournament, onSaved }: { tournament: Tournament; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<TournamentForm>(tournamentFormState(tournament))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  useEffect(() => {
    if (!editing) setForm(tournamentFormState(tournament))
  }, [tournament, editing])

  const save = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    try {
      await api.adminUpdateTournament(tournament.id, payloadFromForm(form))
      setSaveSuccess('Tournament saved')
      setEditing(false)
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save tournament'))
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setForm(tournamentFormState(tournament))
    setSaveError('')
    setSaveSuccess('')
    setEditing(false)
  }

  return (
    <article className={`admin-row-card tournament-card tournament-card-${tournament.status}`}>
      <div className="admin-row-head tournament-card-head">
        <div>
          <span className="team-card-kicker">{tournamentModeLabel(tournament)}</span>
          <strong>{tournament.year} · {tournament.name}</strong>
          <span>{formatTournamentWindow(tournament)}</span>
        </div>
        <div className="row-actions">
          <StatusBadge status={tournament.status} />
          {!editing && <button className="btn secondary small" type="button" onClick={() => setEditing(true)}>Edit tournament</button>}
        </div>
      </div>

      {editing ? (
        <div className="tournament-edit-panel">
          <FormGrid>
            <TournamentFields form={form} setForm={setForm} />
          </FormGrid>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="row-actions">
            <button className="btn secondary small" type="button" onClick={cancel} disabled={saving}>Cancel</button>
            <button className="btn primary small" type="button" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save tournament'}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="tournament-facts-grid">
            <div><span>Workspace</span><strong>{tournamentWorkspaceLabel(tournament)}</strong></div>
            <div><span>Date window</span><strong>{formatTournamentWindow(tournament)}</strong></div>
            <div><span>Public mode</span><strong>{publicModeLabel(tournament)}</strong></div>
          </div>
          <TournamentActionLinks tournament={tournament} />
          {saveSuccess && <p className="form-note" role="status">{saveSuccess}</p>}
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </>
      )}
    </article>
  )
}

function TournamentActionLinks({ tournament }: { tournament: Tournament }) {
  const dashboardLink = `/admin/tournaments/${tournament.id}`

  if (tournament.status === 'completed') {
    return (
      <div className="admin-shortcuts tournament-actions" aria-label={`Review ${tournament.year} archive`}>
        <Link className="primary-shortcut" to={dashboardLink}>Tournament dashboard</Link>
        <Link to={`/history/${tournament.year}`}>Public archive</Link>
        <Link to={tournamentScopedPath('/admin/standings', tournament.id)}>Standings</Link>
        <Link to={tournamentScopedPath('/admin/news', tournament.id)}>Coverage</Link>
        <Link to={tournamentScopedPath('/admin/media', tournament.id)}>Media</Link>
        <Link to={tournamentScopedPath('/admin/sponsors', tournament.id)}>Sponsors</Link>
      </div>
    )
  }

  if (tournament.status === 'cancelled') {
    return (
      <div className="admin-shortcuts tournament-actions" aria-label={`Review ${tournament.year} cancelled tournament`}>
        <Link className="primary-shortcut" to={dashboardLink}>Tournament dashboard</Link>
        <Link to={`/history/${tournament.year}`}>Public archive</Link>
        <Link to={tournamentScopedPath('/admin/news', tournament.id)}>Coverage notes</Link>
      </div>
    )
  }

  return (
    <div className="admin-shortcuts tournament-actions" aria-label={`Manage ${tournament.year} tournament`}>
      <Link className="primary-shortcut" to={dashboardLink}>Tournament dashboard</Link>
      <Link to={tournamentScopedPath('/admin/divisions', tournament.id)}>Teams and divisions</Link>
      <Link to={tournamentScopedPath('/admin/games', tournament.id, { mode: 'schedule' })}>Schedule and scores</Link>
      <Link to={tournamentScopedPath('/admin/game-day', tournament.id)}>Game day</Link>
      <Link to={tournamentScopedPath('/admin/links', tournament.id)}>Tickets and streams</Link>
      <Link to={tournamentScopedPath('/admin/news', tournament.id)}>News</Link>
      <Link to={tournamentScopedPath('/admin/media', tournament.id)}>Media</Link>
      <Link to={tournamentScopedPath('/admin/sponsors', tournament.id)}>Sponsors</Link>
    </div>
  )
}

function TournamentFields({ form, setForm }: { form: TournamentForm; setForm: Dispatch<SetStateAction<TournamentForm>> }) {
  return (
    <>
      <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
      <Field label="Year"><input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} required /></Field>
      <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TournamentStatus })}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
      <Field label="Start date"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></Field>
      <Field label="End date"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></Field>
    </>
  )
}

function tournamentFormState(tournament: Tournament): TournamentForm {
  return {
    name: tournament.name,
    year: String(tournament.year),
    startDate: tournament.startDate || '',
    endDate: tournament.endDate || '',
    status: tournament.status,
  }
}

function payloadFromForm(form: TournamentForm) {
  return {
    name: form.name,
    year: Number(form.year),
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status,
  }
}

function filterAndSortTournaments(tournaments: Tournament[], query: string, status: string, sort: TournamentSortOption) {
  const normalizedQuery = query.trim().toLowerCase()

  return tournaments
    .filter((tournament) => {
      const searchable = [tournament.name, tournament.year, tournament.status, tournament.startDate, tournament.endDate].join(' ').toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
      const matchesStatus = !status || tournament.status === status
      return matchesQuery && matchesStatus
    })
    .slice()
    .sort((a, b) => compareTournaments(a, b, sort))
}

function compareTournaments(a: Tournament, b: Tournament, sort: TournamentSortOption) {
  if (sort === 'yearAsc') return a.year - b.year
  if (sort === 'status') return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.year - a.year
  if (sort === 'name') return `${a.name} ${a.year}`.localeCompare(`${b.name} ${b.year}`, undefined, { numeric: true })
  return b.year - a.year
}

function tournamentModeLabel(tournament: Tournament) {
  if (tournament.status === 'completed') return 'Archive record'
  if (tournament.status === 'cancelled') return 'Cancelled record'
  if (tournament.status === 'live') return 'Live operations'
  return 'Upcoming setup'
}

function tournamentWorkspaceLabel(tournament: Tournament) {
  if (tournament.status === 'completed') return 'Archive review'
  if (tournament.status === 'cancelled') return 'Historical note'
  if (tournament.status === 'live') return 'Game-day operations'
  return 'Setup and launch'
}

function publicModeLabel(tournament: Tournament) {
  if (tournament.status === 'completed') return 'History pages'
  if (tournament.status === 'cancelled') return 'History pages'
  if (tournament.status === 'live') return 'Live hub priority'
  return 'Upcoming hub priority'
}
