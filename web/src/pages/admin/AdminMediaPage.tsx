import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { toDateInputValue } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import type { Game, MediaAsset, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

type MediaForm = { tournamentId?: string; gameId: string; source: string; title: string; imageUrl: string; articleUrl: string; caption: string; tags: string; takenAt: string }

export function AdminMediaPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, media, games] = await Promise.all([api.adminTournaments(), api.adminMedia(tournamentId || null), api.adminGames(tournamentId || null)])
    return { tournaments: tournaments.tournaments, mediaAssets: media.mediaAssets, games: games.games }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading media" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Media assets" description="Manage sourced images for the public gallery and optionally attach photos to a specific game." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <CreateMediaPanel tournaments={data?.tournaments || []} games={data?.games || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        {!data?.mediaAssets.length ? <EmptyState title="No media found" /> : <div className="admin-list">{data.mediaAssets.map((asset) => <MediaRow key={asset.id} asset={asset} games={data.games} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateMediaPanel({ tournaments, games, selectedTournamentId, onSaved }: { tournaments: Tournament[]; games: Game[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const defaultTournamentId = selectedTournamentId || tournaments[0]?.id || ''
  const [form, setForm] = useState<MediaForm>({ tournamentId: defaultTournamentId, gameId: '', source: 'GSPN', title: '', imageUrl: '', articleUrl: '', caption: '', tags: '', takenAt: '' })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!defaultTournamentId) return

    setForm((current) => {
      if (current.tournamentId === defaultTournamentId) return current
      if (selectedTournamentId || !current.tournamentId) return { ...current, tournamentId: defaultTournamentId, gameId: '' }
      return current
    })
  }, [defaultTournamentId, selectedTournamentId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const tournamentId = form.tournamentId || defaultTournamentId
    if (!tournamentId) {
      setMessage('Select a tournament before creating media')
      return
    }

    try {
      await api.adminCreateMedia(cleanMedia({ ...form, tournamentId }))
      setForm({ ...form, tournamentId, gameId: '', title: '', imageUrl: '', articleUrl: '', caption: '', tags: '' })
      setMessage('Media created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create media')
    }
  }

  return <Panel><div className="section-heading"><h2>Add media</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><MediaFields form={form} setForm={setForm} tournaments={tournaments} games={games} includeTournament /><button className="btn primary" type="submit" disabled={!form.tournamentId}>Create media</button></form></Panel>
}

function MediaRow({ asset, games, onSaved }: { asset: MediaAsset; games: Game[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<MediaForm>({ tournamentId: asset.tournamentId, gameId: asset.gameId || '', source: asset.source, title: asset.title, imageUrl: asset.imageUrl, articleUrl: asset.articleUrl || '', caption: asset.caption || '', tags: asset.tags || '', takenAt: toDateInputValue(asset.takenAt) })
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

  return <article className="admin-row-card media-admin-row">{asset.imageUrl && <img src={asset.imageUrl} alt="" loading="lazy" />}<MediaFields form={form} setForm={setForm} games={games} />{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="row-actions"><button className="btn secondary" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save'}</button><button className="btn danger" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div></article>
}

function MediaFields({ form, setForm, tournaments, games = [], includeTournament = false }: { form: MediaForm; setForm: Dispatch<SetStateAction<MediaForm>>; tournaments?: Tournament[]; games?: Game[]; includeTournament?: boolean }) {
  const availableGames = games.filter((game) => !form.tournamentId || game.tournamentId === form.tournamentId)

  return <FormGrid>{includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value, gameId: '' })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}<Field label="Related game"><select value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })}><option value="">Tournament-level photo</option>{availableGames.map((game) => <option key={game.id} value={game.id}>{gameOptionLabel(game)}</option>)}</select></Field><Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field><Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required /></Field><Field label="Image URL"><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} required /></Field><Field label="Article URL"><input value={form.articleUrl} onChange={(event) => setForm({ ...form, articleUrl: event.target.value })} /></Field><Field label="Taken"><input type="date" value={form.takenAt} onChange={(event) => setForm({ ...form, takenAt: event.target.value })} /></Field><Field label="Tags"><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></Field><Field label="Caption"><input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} /></Field></FormGrid>
}

function cleanMedia(form: MediaForm) {
  return { ...form, gameId: form.gameId || null, articleUrl: form.articleUrl || null, caption: form.caption || null, tags: form.tags || null, takenAt: form.takenAt || null }
}
