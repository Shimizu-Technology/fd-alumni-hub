import { Link } from 'react-router-dom'
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
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

const STATUSES: TournamentStatus[] = ['upcoming', 'live', 'completed', 'cancelled']

export function AdminTournamentsPage() {
  const { data, loading, error, reload } = useAsync(() => api.adminTournaments(), [])

  if (loading && !data) return <LoadingState label="Loading tournaments" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Tournament setup"
        description="Create the tournament year, set dates, and choose the status that controls what fans see first. Add teams next, then build the schedule."
      />

      <Panel className="workflow-panel">
        <div className="section-heading"><h2>Recommended setup flow</h2><span>Per tournament</span></div>
        <div className="workflow-steps">
          <span>1. Teams and divisions</span>
          <span>2. Schedule</span>
          <span>3. Scores and standings</span>
          <span>4. Tickets and streams</span>
          <span>5. Coverage and sponsors</span>
        </div>
      </Panel>

      <CreateTournamentPanel onSaved={reload} />

      <Panel>
        <div className="section-heading"><h2>Tournaments</h2><span>{tournaments.length}</span></div>
        {!tournaments.length ? <EmptyState title="No tournaments found" description="Create the tournament year before adding teams and games." /> : (
          <div className="admin-list">
            {tournaments.map((tournament) => <TournamentRow key={tournament.id} tournament={tournament} onSaved={reload} />)}
          </div>
        )}
      </Panel>
    </div>
  )
}

function CreateTournamentPanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const defaultYear = useMemo(() => String(new Date().getFullYear()), [])
  const [form, setForm] = useState<TournamentForm>({
    name: 'FD Alumni Basketball Tournament',
    year: defaultYear,
    startDate: '',
    endDate: '',
    status: 'upcoming',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      await api.adminCreateTournament(payloadFromForm(form))
      setMessage('Tournament created. Add teams next, then create games.')
      setForm((current) => ({ ...current, year: String(Number(current.year || defaultYear) + 1), startDate: '', endDate: '', status: 'upcoming' }))
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to create tournament'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="section-heading"><h2>Create tournament</h2>{message && <span>{message}</span>}</div>
      <form onSubmit={submit}>
        <TournamentFields form={form} setForm={setForm} />
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Creating' : 'Create tournament'}</button>
      </form>
    </Panel>
  )
}

function TournamentRow({ tournament, onSaved }: { tournament: Tournament; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<TournamentForm>({
    name: tournament.name,
    year: String(tournament.year),
    startDate: tournament.startDate || '',
    endDate: tournament.endDate || '',
    status: tournament.status,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    setSaveSuccess('')

    try {
      await api.adminUpdateTournament(tournament.id, payloadFromForm(form))
      setSaveSuccess('Tournament saved')
      await onSaved()
    } catch (err) {
      setSaveError(mutationErrorMessage(err, 'Unable to save tournament'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="admin-row-card">
      <div className="admin-row-head">
        <div>
          <strong>{tournament.year} · {tournament.name}</strong>
          <span>{formatTournamentWindow(tournament)}</span>
        </div>
        <StatusBadge status={tournament.status} />
      </div>
      <TournamentFields form={form} setForm={setForm} />
      <div className="admin-shortcuts tournament-actions" aria-label={`Manage ${tournament.year} tournament`}>
        <Link to={tournamentScopedPath('/admin/divisions', tournament.id)}>Teams and divisions</Link>
        <Link to={tournamentScopedPath('/admin/games', tournament.id, { mode: 'schedule' })}>Build schedule</Link>
        <Link to={tournamentScopedPath('/admin/games', tournament.id, { mode: 'scores' })}>Enter scores</Link>
        <Link to={tournamentScopedPath('/admin/standings', tournament.id)}>Standings</Link>
        <Link to={tournamentScopedPath('/admin/links', tournament.id)}>Tickets and streams</Link>
        <Link to={tournamentScopedPath('/admin/news', tournament.id)}>News</Link>
        <Link to={tournamentScopedPath('/admin/media', tournament.id)}>Media</Link>
        <Link to={tournamentScopedPath('/admin/sponsors', tournament.id)}>Sponsors</Link>
      </div>
      {saveSuccess && <p className="form-note" role="status">{saveSuccess}</p>}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save tournament'}</button>
    </article>
  )
}

function TournamentFields({ form, setForm }: { form: TournamentForm; setForm: Dispatch<SetStateAction<TournamentForm>> }) {
  return (
    <FormGrid>
      <Field label="Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
      <Field label="Year"><input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} required /></Field>
      <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TournamentStatus })}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
      <Field label="Start date"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></Field>
      <Field label="End date"><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></Field>
    </FormGrid>
  )
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
