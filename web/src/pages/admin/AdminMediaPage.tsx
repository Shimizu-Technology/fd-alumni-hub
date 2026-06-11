import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { toDateInputValue } from '../../lib/datetime'
import type { MediaAsset, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

type MediaForm = { tournamentId?: string; source: string; title: string; imageUrl: string; articleUrl: string; caption: string; tags: string; takenAt: string }

export function AdminMediaPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, media] = await Promise.all([api.adminTournaments(), api.adminMedia(tournamentId || null)])
    return { tournaments: tournaments.tournaments, mediaAssets: media.mediaAssets }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading media" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Media assets" description="Manage sourced images for the public gallery." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <CreateMediaPanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        {!data?.mediaAssets.length ? <EmptyState title="No media found" /> : <div className="admin-list">{data.mediaAssets.map((asset) => <MediaRow key={asset.id} asset={asset} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateMediaPanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<MediaForm>({ tournamentId: selectedTournamentId || tournaments[0]?.id || '', source: 'GSPN', title: '', imageUrl: '', articleUrl: '', caption: '', tags: '', takenAt: '' })
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.adminCreateMedia(cleanMedia(form))
      setForm({ ...form, title: '', imageUrl: '', articleUrl: '', caption: '', tags: '' })
      setMessage('Media created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create media')
    }
  }

  return <Panel><div className="section-heading"><h2>Add media</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><MediaFields form={form} setForm={setForm} tournaments={tournaments} includeTournament /><button className="btn primary" type="submit">Create media</button></form></Panel>
}

function MediaRow({ asset, onSaved }: { asset: MediaAsset; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<MediaForm>({ source: asset.source, title: asset.title, imageUrl: asset.imageUrl, articleUrl: asset.articleUrl || '', caption: asset.caption || '', tags: asset.tags || '', takenAt: toDateInputValue(asset.takenAt) })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const save = async () => {
    setSaving(true)
    setMutationError('')
    try {
      await api.adminUpdateMedia(asset.id, cleanMedia(form))
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to save media asset'))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!confirm('Delete this media asset?')) return
    setDeleting(true)
    setMutationError('')
    try {
      await api.adminDeleteMedia(asset.id)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to delete media asset'))
    } finally {
      setDeleting(false)
    }
  }

  return <article className="admin-row-card media-admin-row">{asset.imageUrl && <img src={asset.imageUrl} alt="" loading="lazy" />}<MediaFields form={form} setForm={setForm} />{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="row-actions"><button className="btn secondary" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save'}</button><button className="btn danger" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div></article>
}

function MediaFields({ form, setForm, tournaments, includeTournament = false }: { form: MediaForm; setForm: Dispatch<SetStateAction<MediaForm>>; tournaments?: Tournament[]; includeTournament?: boolean }) {
  return <FormGrid>{includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}<Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field><Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required /></Field><Field label="Image URL"><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} required /></Field><Field label="Article URL"><input value={form.articleUrl} onChange={(event) => setForm({ ...form, articleUrl: event.target.value })} /></Field><Field label="Taken"><input type="date" value={form.takenAt} onChange={(event) => setForm({ ...form, takenAt: event.target.value })} /></Field><Field label="Tags"><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></Field><Field label="Caption"><input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} /></Field></FormGrid>
}

function cleanMedia(form: MediaForm) {
  return { ...form, articleUrl: form.articleUrl || null, caption: form.caption || null, tags: form.tags || null, takenAt: form.takenAt || null }
}
