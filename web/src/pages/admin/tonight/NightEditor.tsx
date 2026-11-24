import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api, ApiError } from '../../../lib/api'
import { formatGuamDate } from '../../../lib/datetime'
import { mutationErrorMessage } from '../../../lib/errors'
import { ADMIN_IMAGE_UPLOAD_ACCEPT, uploadAdminImage } from '../../../lib/uploads'
import { safePublicImageHref } from '../../../lib/urls'
import type { GameDayNote, HostSpotlight, MenuItem, SpecialEvent, TonightPayload } from '../../../lib/types'
import { Field, FormGrid, Panel } from '../../../components/ui'
import { TonightGuide } from '../../public/TodayPage'

type Draft = Pick<GameDayNote, 'menuItems' | 'specialEvents' | 'hostSpotlight' | 'photos' | 'foodMenu' | 'hostClass' | 'announcement' | 'sponsorShoutout' | 'lockVersion'>

const photoLimit = 16

function fromNote(note: GameDayNote | null): Draft {
  return {
    menuItems: note?.menuItems || [],
    specialEvents: note?.specialEvents || [],
    hostSpotlight: note?.hostSpotlight || {},
    photos: note?.photos || [],
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

const spotlightFields: [keyof Pick<HostSpotlight, 'hostClassLabel' | 'headline' | 'body'>, string, number][] = [
  ['hostClassLabel', 'Host class label', 80], ['headline', 'Spotlight headline', 180],
  ['body', 'Spotlight blurb', 2000],
]

function parseCachedDraft(raw: string): Draft | null {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  const menuItems = Array.isArray(record.menuItems) ? (record.menuItems as MenuItem[]) : []
  const specialEvents = Array.isArray(record.specialEvents) ? (record.specialEvents as SpecialEvent[]) : []
  const hostSpotlight = record.hostSpotlight && typeof record.hostSpotlight === 'object' && !Array.isArray(record.hostSpotlight)
    ? (record.hostSpotlight as HostSpotlight)
    : {}
  return {
    menuItems,
    specialEvents,
    hostSpotlight,
    photos: Array.isArray(record.photos) ? record.photos.filter((photo) => photo && typeof photo.url === 'string' &&
      (photo.caption === undefined || typeof photo.caption === 'string')).slice(0, photoLimit) : undefined,
    foodMenu: typeof record.foodMenu === 'string' ? record.foodMenu : '',
    hostClass: typeof record.hostClass === 'string' ? record.hostClass : '',
    announcement: typeof record.announcement === 'string' ? record.announcement : '',
    sponsorShoutout: typeof record.sponsorShoutout === 'string' ? record.sponsorShoutout : '',
    lockVersion: typeof record.lockVersion === 'number' ? record.lockVersion : undefined,
  }
}

export function NightEditor({ tournamentId, date, note, canEdit, canPublish }: {
  tournamentId: string; date: string; note: GameDayNote | null; canEdit: boolean; canPublish: boolean
}) {
  const storageKey = `fd-tonight-draft:${tournamentId}:${date}`
  const [savedNote, setSavedNote] = useState(note)
  const [form, setForm] = useState<Draft>(() => {
    try {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        const parsed = parseCachedDraft(cached)
        if (parsed) return { ...parsed, photos: parsed.photos ?? note?.photos ?? [] }
      }
    } catch {
      // The editor still works when storage is unavailable or corrupted.
    }
    return fromNote(note)
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadRequest = useRef<AbortController | null>(null)
  useEffect(() => () => uploadRequest.current?.abort(), [])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState<GameDayNote | null>(null)
  const [preview, setPreview] = useState<TonightPayload | null>(null)
  const canChange = savedNote?.status === 'published' ? canPublish : canEdit || canPublish
  const disabled = busy || uploading
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
    if (!canChange || disabled || uploadRequest.current || conflict) return
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
  const photos = form.photos || []
  const spotlightPhoto = safePublicImageHref(form.hostSpotlight?.photoUrl)

  async function uploadPhotos(event: ChangeEvent<HTMLInputElement>, destination: 'spotlight' | 'gallery') {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !canChange || disabled || uploadRequest.current) return

    const request = new AbortController()
    uploadRequest.current = request
    setUploading(true)
    setError('')
    setMessage('')
    const capacity = destination === 'spotlight' ? 1 : photoLimit - photos.length
    const selected = files.slice(0, capacity)
    try {
      const results = await Promise.allSettled(selected.map((file) =>
        uploadAdminImage({ file, tournamentId, purpose: 'tonight-photo', signal: request.signal }),
      ))
      if (request.signal.aborted) return

      const added: NonNullable<Draft['photos']> = []
      const failures: string[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') added.push({ url: result.value })
        else failures.push(`${selected[index].name} (${mutationErrorMessage(result.reason, 'upload failed')})`)
      })
      if (added.length) {
        if (destination === 'spotlight') change({ ...form, hostSpotlight: { ...form.hostSpotlight, photoUrl: added[0].url } })
        else change({ ...form, photos: [...photos, ...added] })
      }
      const skipped = files.slice(capacity).map((file) => file.name)
      setError([
        failures.length ? `Could not upload ${failures.join(', ')}.` : '',
        skipped.length ? `The gallery holds up to ${photoLimit} images. Skipped ${skipped.join(', ')}.` : '',
      ].filter(Boolean).join(' '))
      if (added.length) setMessage(destination === 'spotlight' ? 'Spotlight photo uploaded' : `${added.length} ${added.length === 1 ? 'image' : 'images'} uploaded`)
    } finally {
      uploadRequest.current = null
      if (!request.signal.aborted) setUploading(false)
    }
  }

  const showPreview = () => run(async () => {
    const data = await api.adminPreviewNight(tournamentId, date)
    setPreview(data)
  })

  return (
    <Panel>
      <div className="section-heading"><h2>Nightly Menu &amp; Events</h2><span>{savedNote?.status === 'published' ? 'Published' : 'Draft'}</span></div>
      <form className="stacked-form" onSubmit={save}>
        <fieldset className="night-editor-fieldset" disabled={!canChange || disabled}>
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
          {(savedNote?.foodMenu?.trim() || form.foodMenu?.trim()) && (
            <Field label="Legacy menu (shown when there are no menu items)"><textarea value={form.foodMenu || ''} onChange={(event) => change({ ...form, foodMenu: event.target.value })} /></Field>
          )}
        </fieldset>
        <fieldset className="night-editor-fieldset" disabled={!canChange || disabled}>
          <legend>Special Events &amp; Theme Nights</legend>
          {events.map((item, index) => <EventRow key={index} item={item} index={index}
            onChange={(value) => change({ ...form, specialEvents: replaceRow(events, index, value) })}
            onRemove={() => change({ ...form, specialEvents: events.filter((_, position) => position !== index) })} />)}
          <button type="button" className="btn secondary" onClick={() => change({ ...form, specialEvents: [...events, { title: '' }] })}>Add special event</button>
        </fieldset>
        <fieldset className="night-editor-fieldset" disabled={!canChange || disabled}>
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
          {spotlightPhoto && <img className="night-spotlight-photo night-spotlight-preview" src={spotlightPhoto} alt="Spotlight photo preview" />}
          <div className="row-actions">
            <Field label={form.hostSpotlight?.photoUrl ? 'Replace photo' : 'Upload photo'}>
              <input type="file" accept={ADMIN_IMAGE_UPLOAD_ACCEPT} onChange={(event) => void uploadPhotos(event, 'spotlight')} />
            </Field>
            {form.hostSpotlight?.photoUrl && <button type="button" className="btn secondary small" onClick={() =>
              change({ ...form, hostSpotlight: { ...form.hostSpotlight, photoUrl: '' } })}>Remove spotlight photo</button>}
          </div>
        </fieldset>
        <fieldset className="night-editor-fieldset" disabled={!canChange || disabled}>
          <legend>Tonight’s Photos &amp; Flyers</legend>
          <Field label={`Upload photos or flyers (${photos.length} of ${photoLimit})`}>
            <input type="file" multiple accept={ADMIN_IMAGE_UPLOAD_ACCEPT} disabled={photos.length >= photoLimit}
              onChange={(event) => void uploadPhotos(event, 'gallery')} />
          </Field>
          {photos.length > 0 && <ul className="night-photo-editor">
            {photos.map((photo, index) => {
              const src = safePublicImageHref(photo.url)
              return <li key={`${photo.url}-${index}`} className="admin-row-card">
                {src && <img src={src} alt={`Photo or flyer ${index + 1} preview`} loading="lazy" />}
                <Field label={`Caption for image ${index + 1}`}>
                  <input maxLength={240} value={photo.caption || ''} onChange={(event) => change({
                    ...form, photos: replaceRow(photos, index, { ...photo, caption: event.target.value }),
                  })} />
                </Field>
                <button type="button" className="btn secondary small" aria-label={`Remove image ${index + 1}`} onClick={() =>
                  change({ ...form, photos: photos.filter((_, position) => position !== index) })}>Remove</button>
              </li>
            })}
          </ul>}
        </fieldset>
        {(savedNote?.announcement?.trim() || savedNote?.sponsorShoutout?.trim() || form.announcement?.trim() || form.sponsorShoutout?.trim()) && <details>
          <summary>Legacy announcement &amp; sponsor copy</summary>
          <fieldset className="night-editor-fieldset" disabled={!canChange || disabled}>
            <FormGrid>
              <Field label="Announcement"><textarea value={form.announcement || ''} onChange={(event) => change({ ...form, announcement: event.target.value })} /></Field>
              <Field label="Sponsor shoutout"><textarea value={form.sponsorShoutout || ''} onChange={(event) => change({ ...form, sponsorShoutout: event.target.value })} /></Field>
            </FormGrid>
          </fieldset>
        </details>}
        {uploading && <p role="status">Uploading images…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        {conflict && <div className="notice-panel">
          <p>Someone else saved this night. Reload their note to discard your edits, or keep your edits and save again to overwrite their changes.</p>
          <div className="row-actions">
            <button type="button" className="btn secondary" disabled={disabled} onClick={() => accept(conflict)}>Reload current note</button>
            {(conflict.status === 'published' ? canPublish : canEdit || canPublish) && <button type="button" className="btn secondary" disabled={disabled} onClick={() => {
              setSavedNote(conflict)
              change({ ...form, lockVersion: conflict.lockVersion })
              setConflict(null)
              setError('')
            }}>Keep my edits</button>}
          </div>
        </div>}
        <div className="row-actions">
          {(savedNote?.status === 'published' ? canPublish : canEdit) && <button className="btn secondary" type="submit" value="draft" disabled={disabled || !!conflict}>{savedNote?.status === 'published' ? 'Unpublish to draft' : 'Save draft'} · {dateLabel}</button>}
          <button className="btn secondary" type="button" disabled={disabled} onClick={showPreview}>Preview this night · {dateLabel}</button>
          {canPublish && <button className="btn primary" type="submit" value="published" disabled={disabled || !!conflict}>Publish · {dateLabel}</button>}
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
