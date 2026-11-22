import { useState, type FormEvent } from 'react'
import { api } from '../../../lib/api'
import { formatGuamDate, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../../lib/datetime'
import { mutationErrorMessage } from '../../../lib/errors'
import { useAsync } from '../../../lib/hooks'
import type { TournamentUpdate } from '../../../lib/types'
import { ErrorState, Field, FormGrid, LoadingState, Panel } from '../../../components/ui'

const emptyForm = { title: '', body: '', targetDate: '', expiresAt: '', pinned: false }

export function UpdatesPanel({ tournamentId, date, canEdit, canPublish }: {
  tournamentId: string; date: string; canEdit: boolean; canPublish: boolean
}) {
  const updates = useAsync(() => api.adminTournamentUpdates(tournamentId), [tournamentId])
  const [editing, setEditing] = useState<TournamentUpdate | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const published = editing?.status === 'published'

  function edit(update: TournamentUpdate | null) {
    setEditing(update)
    setForm(update ? {
      title: update.title, body: update.body, targetDate: update.targetDate || '',
      expiresAt: toLocalDateTimeInputValue(update.expiresAt), pinned: update.pinned,
    } : emptyForm)
    setError('')
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      await updates.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to change this update'))
    } finally {
      setBusy(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const status = submitter?.value === 'published' ? 'published' : 'draft'
    void run(async () => {
      await api.adminSaveTournamentUpdate(tournamentId, {
        ...form, id: editing?.id, status, targetDate: form.targetDate || null,
        expiresAt: guamLocalDateTimeInputToIso(form.expiresAt) || null,
      })
      edit(null)
    }, status === 'published' ? 'Update published' : 'Update draft saved')
  }

  function remove(update: TournamentUpdate) {
    if (!window.confirm(`Delete “${update.title}”?`)) return

    void run(async () => {
      await api.adminDeleteTournamentUpdate(update.id)
      if (editing?.id === update.id) edit(null)
    }, 'Update deleted')
  }

  return <Panel>
    <h2>Post an update</h2>
    <p>Use organizer updates for routine news. Choose a Guam date to show the post on that night only.</p>
    {(canEdit || canPublish) && <form className="stacked-form" onSubmit={save}>
      {editing && <h3>Editing {editing.title}</h3>}
      <fieldset className="night-editor-fieldset" disabled={busy}>
        <FormGrid>
          <Field label="Update title"><input required maxLength={140} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <Field label="Target date (Guam, optional)"><input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></Field>
          <Field label="Update body"><textarea required maxLength={4000} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field>
          <Field label="Expiry (Guam time, optional)"><input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></Field>
          <label className="check-field"><input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} /> Pin update</label>
          <button className="btn secondary small" type="button" onClick={() => setForm({ ...form, targetDate: date })}>Use selected night</button>
        </FormGrid>
      </fieldset>
      <div className="row-actions">
        {(published ? canPublish : canEdit) && <button className="btn secondary" type="submit" value="draft" disabled={busy}>{published ? 'Unpublish update' : 'Save update draft'}</button>}
        {canPublish && <button className="btn primary" type="submit" value="published" disabled={busy}>Publish update</button>}
        {editing && <button className="btn secondary" type="button" disabled={busy} onClick={() => edit(null)}>Cancel editing</button>}
      </div>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {updates.error ? <ErrorState message={updates.error} onRetry={updates.reload} /> : updates.loading && !updates.data ? <LoadingState label="Loading organizer updates" /> : null}
    <div className="admin-list">
      {updates.data?.updates.map((update) => {
        const writable = update.status === 'published' ? canPublish : canEdit || canPublish
        const deletable = update.status === 'published' ? canPublish : canEdit
        return <article key={update.id} className="admin-row-card">
          <div>
            <strong>{update.title}</strong>
            <p className="muted">{update.status === 'published' ? 'Published' : 'Draft'} · {update.targetDate ? formatGuamDate(update.targetDate) : 'All nights'}{update.pinned ? ' · Pinned' : ''}{update.expiresAt && Date.parse(update.expiresAt) <= Date.now() ? ' · Expired' : ''}</p>
            <p className="night-copy">{update.body}</p>
          </div>
          <div className="row-actions">
            {writable && <button className="btn secondary small" type="button" disabled={busy} onClick={() => edit(update)}>Edit update</button>}
            {deletable && <button className="btn danger small" type="button" disabled={busy} onClick={() => remove(update)}>Delete update</button>}
          </div>
        </article>
      })}
    </div>
  </Panel>
}
