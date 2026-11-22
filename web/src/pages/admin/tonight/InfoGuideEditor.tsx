import { useState, type FormEvent } from 'react'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import type { InfoGuide } from '../../../lib/types'
import { Field, FormGrid, Panel } from '../../../components/ui'

const textFields = [
  ['venueName', 'Venue name', 180], ['venueAddress', 'Venue address', 280],
  ['ticketSourceName', 'Ticket source name', 80], ['ticketSourceUrl', 'Ticket link', 2048],
  ['ticketSummary', 'Ticket summary', 1200], ['doorInfo', 'Door information', 1200],
  ['bylawDisclaimer', 'Bylaw disclaimer', 1200],
] as const

const listFields = [
  ['eligibilityHighlights', 'Eligibility highlights'],
  ['gameRuleHighlights', 'Game rule highlights'],
  ['conductHighlights', 'Conduct highlights'],
] as const

export function InfoGuideEditor({ tournamentId, guide, canEdit }: { tournamentId: string; guide: InfoGuide; canEdit: boolean }) {
  const [form, setForm] = useState(guide)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setError('')
    try {
      const copy = { ...form }
      for (const [key] of listFields) copy[key] = copy[key].map((line) => line.trim()).filter(Boolean)
      const response = await api.adminSaveInfoGuide(tournamentId, copy)
      setForm(response.infoGuide)
      setNotice('Venue & rules saved')
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save venue & rules'))
    } finally {
      setBusy(false)
    }
  }

  return <details>
    <summary>Venue &amp; Rules · {form.venueName}</summary>
    <Panel>
      <form className="stacked-form" onSubmit={save}>
        <fieldset disabled={!canEdit || busy} className="night-editor-fieldset">
          <FormGrid>
            {textFields.map(([key, label, maxLength]) => <Field key={key} label={label}>
              <textarea rows={maxLength === 1200 ? 3 : 1} maxLength={maxLength} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
            </Field>)}
            {listFields.map(([key, label]) => <Field key={key} label={`${label} (one per line)`}>
              <textarea rows={4} value={form[key].join('\n')} onChange={(event) => setForm({ ...form, [key]: event.target.value.split('\n') })} />
            </Field>)}
          </FormGrid>
        </fieldset>
        {canEdit && <button className="btn primary" type="submit" disabled={busy}>Save venue &amp; rules</button>}
        {notice && <p role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Panel>
  </details>
}
