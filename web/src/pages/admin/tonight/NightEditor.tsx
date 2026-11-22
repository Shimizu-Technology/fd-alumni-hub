import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../../lib/api'
import { formatGuamDate } from '../../../lib/datetime'
import { mutationErrorMessage } from '../../../lib/errors'
import type { GameDayNote, HostSpotlight, MenuItem, SpecialEvent, TonightPayload } from '../../../lib/types'
import { Field, FormGrid, Panel } from '../../../components/ui'
import { TonightGuide } from '../../public/TodayPage'

type Draft = Pick<GameDayNote, 'menuItems' | 'specialEvents' | 'hostSpotlight' | 'foodMenu' | 'hostClass' | 'announcement' | 'sponsorShoutout' | 'lockVersion'>

function fromNote(note: GameDayNote | null): Draft {
  return {
    menuItems: note?.menuItems || [],
    specialEvents: note?.specialEvents || [],
    hostSpotlight: note?.hostSpotlight || {},
    foodMenu: note?.foodMenu || '',
    hostClass: note?.hostClass || '',
    announcement: note?.announcement || '',
    sponsorShoutout: note?.sponsorShoutout || '',
    lockVersion: note?.lockVersion,
  }
}

function replaceRow<T>(rows: T[], index: number, value: T) {
  return rows.map((row, position) => position === index ? value : row)
}

function moveRow<T>(rows: T[], index: number, offset: number) {
  const ordered = [...rows]
  const [row] = ordered.splice(index, 1)
  ordered.splice(index + offset, 0, row)
  return ordered
}

const spotlightFields: [keyof Omit<HostSpotlight, 'hostCampaignId'>, string, number][] = [
  ['hostClassLabel', 'Host class label', 80], ['headline', 'Spotlight headline', 180],
  ['body', 'Spotlight blurb', 2000], ['photoUrl', 'Spotlight photo URL', 2048],
]

export function NightEditor({ tournamentId, date, note, canEdit, canPublish }: {
  tournamentId: string; date: string; note: GameDayNote | null; canEdit: boolean; canPublish: boolean
}) {
  const storageKey = `fd-tonight-draft:${tournamentId}:${date}`
  const [savedNote, setSavedNote] = useState(note)
  const [form, setForm] = useState<Draft>(() => {
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) return JSON.parse(cached) as Draft
    } catch {
      // The editor still works when storage is unavailable.
    }
    return fromNote(note)
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<GameDayNote | null>(null)
  const [preview, setPreview] = useState<TonightPayload | null>(null)
  const canChange = savedNote?.status === 'published' ? canPublish : canEdit || canPublish
  const dateLabel = formatGuamDate(date, { weekday: 'short' })

  function change(next: Draft) {
    setForm(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Storage can be unavailable. */ }
  }

  function accept(saved: GameDayNote) {
    setSavedNote(saved)
    setForm(fromNote(saved))
    setConflict(null)
    setPreview(null)
    try { localStorage.removeItem(storageKey) } catch { /* Storage can be unavailable. */ }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict((err.payload as { currentNote?: GameDayNote })?.currentNote || null)
      }
      setError(mutationErrorMessage(err, 'Unable to update this night'))
    } finally {
      setBusy(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const status = submitter?.value === 'published' ? 'published' : 'draft'
    void run(async () => {
      const result = await api.adminSaveGameDayNote({ tournamentId, date, ...form, lockVersion: form.lockVersion ?? null, status, active: true })
      accept(result.gameDayNote)
      setMessage(status === 'draft' ? 'Draft saved' : 'Night published')
    })
  }

  function copyMenu() {
    void run(async () => {
      const { gameDayNote } = await api.adminCopyPreviousMenu(tournamentId, date, form.lockVersion ?? null)
      setSavedNote(gameDayNote)
      setPreview(null)
      change({
        ...form,
        menuItems: gameDayNote.menuItems,
        foodMenu: gameDayNote.foodMenu,
        hostSpotlight: Object.values(form.hostSpotlight || {}).some(Boolean) ? form.hostSpotlight : gameDayNote.hostSpotlight,
        lockVersion: gameDayNote.lockVersion,
      })
      setMessage('Previous menu copied into this night’s draft')
    })
  }

  const menu = form.menuItems || []
  const events = form.specialEvents || []
  const showPreview = () => run(async () => {
    const data = await api.adminPreviewNight(tournamentId, date)
    setPreview(data)
  })

  return (
    <Panel>
      <div className="section-heading"><h2>Nightly Menu &amp; Events</h2><span>{savedNote?.status === 'published' ? 'Published' : 'Draft'}</span></div>
      <form className="stacked-form" onSubmit={save}>
        <fieldset className="night-editor-fieldset" disabled={!canChange || busy}>
          <legend>Food &amp; Drink Menu</legend>
          {menu.map((item, index) => (
            <MenuRow key={index} item={item} index={index} count={menu.length}
              onChange={(value) => change({ ...form, menuItems: replaceRow(menu, index, value) })}
              onMove={(offset) => change({ ...form, menuItems: moveRow(menu, index, offset) })}
              onRemove={() => change({ ...form, menuItems: menu.filter((_, position) => position !== index) })} />
          ))}
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={() => change({ ...form, menuItems: [...menu, { name: '', available: true }] })}>Add menu item</button>
            {canEdit && savedNote?.status !== 'published' && <button type="button" className="btn secondary" disabled={!!conflict} onClick={copyMenu}>Copy last night’s menu</button>}
          </div>
          <Field label="Legacy menu (shown when there are no menu items)"><textarea value={form.foodMenu || ''} onChange={(event) => change({ ...form, foodMenu: event.target.value })} /></Field>
        </fieldset>
        <fieldset className="night-editor-fieldset" disabled={!canChange || busy}>
          <legend>Special Events &amp; Theme Nights</legend>
          {events.map((item, index) => <EventRow key={index} item={item} index={index}
            onChange={(value) => change({ ...form, specialEvents: replaceRow(events, index, value) })}
            onRemove={() => change({ ...form, specialEvents: events.filter((_, position) => position !== index) })} />)}
          <button type="button" className="btn secondary" onClick={() => change({ ...form, specialEvents: [...events, { title: '' }] })}>Add special event</button>
        </fieldset>
        <fieldset className="night-editor-fieldset" disabled={!canChange || busy}>
          <legend>Host Class Spotlight</legend>
          <FormGrid>
            {spotlightFields.map(([key, label, maxLength]) => (
              <Field key={key} label={label}>
                {key === 'body'
                  ? <textarea value={form.hostSpotlight?.[key] || ''} maxLength={maxLength} onChange={(event) => change({ ...form, hostSpotlight: { ...form.hostSpotlight, [key]: event.target.value } })} />
                  : <input value={form.hostSpotlight?.[key] || ''} maxLength={maxLength} onChange={(event) => change({ ...form, hostSpotlight: { ...form.hostSpotlight, [key]: event.target.value } })} />}
              </Field>
            ))}
          </FormGrid>
        </fieldset>
        <details>
          <summary>Legacy announcement &amp; sponsor copy</summary>
          <fieldset className="night-editor-fieldset" disabled={!canChange || busy}>
            <FormGrid>
              <Field label="Announcement"><textarea value={form.announcement || ''} onChange={(event) => change({ ...form, announcement: event.target.value })} /></Field>
              <Field label="Sponsor shoutout"><textarea value={form.sponsorShoutout || ''} onChange={(event) => change({ ...form, sponsorShoutout: event.target.value })} /></Field>
            </FormGrid>
          </fieldset>
        </details>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {conflict && <div className="notice-panel">
          <p>Someone else saved this night. Reload their note to discard your edits, or keep your edits and save again to overwrite their changes.</p>
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={() => accept(conflict)}>Reload current note</button>
            {(conflict.status === 'published' ? canPublish : canEdit || canPublish) && <button type="button" className="btn secondary" onClick={() => {
              setSavedNote(conflict)
              change({ ...form, lockVersion: conflict.lockVersion })
              setConflict(null)
              setError('')
            }}>Keep my edits</button>}
          </div>
        </div>}
        <div className="row-actions">
          {(savedNote?.status === 'published' ? canPublish : canEdit) && <button className="btn secondary" type="submit" value="draft" disabled={busy || !!conflict}>{savedNote?.status === 'published' ? 'Unpublish to draft' : 'Save draft'} · {dateLabel}</button>}
          <button className="btn secondary" type="button" disabled={busy} onClick={showPreview}>Preview this night · {dateLabel}</button>
          {canPublish && <button className="btn primary" type="submit" value="published" disabled={busy || !!conflict}>Publish · {dateLabel}</button>}
        </div>
      </form>
      {preview && <section className="page-stack night-preview" aria-label="Night preview">
        <h3>Preview · {dateLabel} (Guam)</h3>
        <TonightGuide data={{ ...preview, gameDayNote: canChange ? { id: '', tournamentId, date, active: true, ...form } : preview.gameDayNote }} />
      </section>}
    </Panel>
  )
}

function MenuRow({ item, index, count, onChange, onMove, onRemove }: {
  item: MenuItem; index: number; count: number; onChange: (value: MenuItem) => void; onMove: (offset: number) => void; onRemove: () => void
}) {
  return <fieldset className="admin-row-card night-editor-fieldset">
    <legend>Menu item {index + 1}</legend>
    <FormGrid>
      <Field label="Item name"><input required maxLength={140} value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} /></Field>
      <Field label="Price"><input maxLength={40} value={item.price || ''} onChange={(event) => onChange({ ...item, price: event.target.value })} /></Field>
      <Field label="Category"><input maxLength={80} value={item.category || ''} onChange={(event) => onChange({ ...item, category: event.target.value })} /></Field>
      <Field label="Item notes"><input maxLength={500} value={item.notes || ''} onChange={(event) => onChange({ ...item, notes: event.target.value })} /></Field>
      <label className="check-field"><input type="checkbox" checked={item.available !== false} onChange={(event) => onChange({ ...item, available: event.target.checked })} /> Available</label>
    </FormGrid>
    <div className="row-actions">
      <button type="button" className="btn secondary small" disabled={index === 0} onClick={() => onMove(-1)}>Move up</button>
      <button type="button" className="btn secondary small" disabled={index === count - 1} onClick={() => onMove(1)}>Move down</button>
      <button type="button" className="btn secondary small" onClick={onRemove}>Remove item</button>
    </div>
  </fieldset>
}

function EventRow({ item, index, onChange, onRemove }: {
  item: SpecialEvent; index: number; onChange: (value: SpecialEvent) => void; onRemove: () => void
}) {
  return <fieldset className="admin-row-card night-editor-fieldset">
    <legend>Special event {index + 1}</legend>
    <FormGrid>
      <Field label="Event title"><input required maxLength={180} value={item.title} onChange={(event) => onChange({ ...item, title: event.target.value })} /></Field>
      <Field label="Time"><input maxLength={80} value={item.timeLabel || ''} onChange={(event) => onChange({ ...item, timeLabel: event.target.value })} /></Field>
      <Field label="Description"><textarea maxLength={1000} value={item.description || ''} onChange={(event) => onChange({ ...item, description: event.target.value })} /></Field>
    </FormGrid>
    <button type="button" className="btn secondary small" onClick={onRemove}>Remove event</button>
  </fieldset>
}
