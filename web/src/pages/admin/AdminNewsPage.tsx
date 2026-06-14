import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { toDateInputValue } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import type { Article, Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'
import { ImageUrlUploadField } from '../../components/admin/ImageUrlUploadField'

type ArticleForm = { tournamentId: string; gameId: string; title: string; source: string; url: string; publishedAt: string; imageUrl: string; excerpt: string }

export function AdminNewsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, articles, games] = await Promise.all([api.adminTournaments(), api.adminArticles(tournamentId || null), api.adminGames(tournamentId || null)])
    return { tournaments: tournaments.tournaments, articles: articles.articles, games: games.games }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading articles" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="News links" description="Create sourced article links, optionally attach them to a game, and publish them to the public coverage archive." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <CreateArticlePanel tournaments={data?.tournaments || []} games={data?.games || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        {!data?.articles.length ? <EmptyState title="No articles found" /> : <div className="admin-list">{data.articles.map((article) => <ArticleRow key={article.id} article={article} games={data.games} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateArticlePanel({ tournaments, games, selectedTournamentId, onSaved }: { tournaments: Tournament[]; games: Game[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const defaultTournamentId = selectedTournamentId || tournaments[0]?.id || ''
  const [form, setForm] = useState<ArticleForm>({ tournamentId: defaultTournamentId, gameId: '', title: '', source: 'GSPN', url: '', publishedAt: '', imageUrl: '', excerpt: '' })
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
      setMessage('Select a tournament before creating an article')
      return
    }

    try {
      await api.adminCreateArticle({ ...form, tournamentId, gameId: form.gameId || null, publishedAt: form.publishedAt || null, imageUrl: form.imageUrl || null, excerpt: form.excerpt || null })
      setForm({ ...form, tournamentId, gameId: '', title: '', url: '', imageUrl: '', excerpt: '' })
      setMessage('Article created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create article')
    }
  }

  return <Panel><div className="section-heading"><h2>Add article</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><ArticleFields form={form} setForm={setForm} tournaments={tournaments} games={games} includeTournament /><button className="btn primary" type="submit" disabled={!form.tournamentId}>Create article</button></form></Panel>
}

function ArticleRow({ article, games, onSaved }: { article: Article; games: Game[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ArticleForm>({ tournamentId: article.tournamentId, gameId: article.gameId || '', title: article.title, source: article.source, url: article.url, publishedAt: toDateInputValue(article.publishedAt), imageUrl: article.imageUrl || '', excerpt: article.excerpt || '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const save = async () => {
    setSaving(true)
    setMutationError('')
    try {
      await api.adminUpdateArticle(article.id, { ...form, gameId: form.gameId || null, publishedAt: form.publishedAt || null, imageUrl: form.imageUrl || null, excerpt: form.excerpt || null })
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to save article'))
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    if (!confirm('Delete this article link?')) return
    setDeleting(true)
    setMutationError('')
    try {
      await api.adminDeleteArticle(article.id)
      await onSaved()
    } catch (err) {
      setMutationError(mutationErrorMessage(err, 'Unable to delete article'))
    } finally {
      setDeleting(false)
    }
  }

  return <article className="admin-row-card"><ArticleFields form={form} setForm={setForm} games={games} />{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="row-actions"><button className="btn secondary" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save'}</button><button className="btn danger" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div></article>
}

function ArticleFields({ form, setForm, tournaments, games = [], includeTournament = false }: { form: ArticleForm; setForm: Dispatch<SetStateAction<ArticleForm>>; tournaments?: Tournament[]; games?: Game[]; includeTournament?: boolean }) {
  const availableGames = games.filter((game) => !form.tournamentId || game.tournamentId === form.tournamentId)

  return (
    <FormGrid>
      {includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value, gameId: '' })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}
      <Field label="Related game"><select value={form.gameId} onChange={(event) => setForm({ ...form, gameId: event.target.value })}><option value="">Tournament-level article</option>{availableGames.map((game) => <option key={game.id} value={game.id}>{gameOptionLabel(game)}</option>)}</select></Field>
      <Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
      <Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required /></Field>
      <Field label="URL"><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required /></Field>
      <Field label="Published"><input type="date" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} /></Field>
      <ImageUrlUploadField label="Image URL" value={form.imageUrl} tournamentId={form.tournamentId} purpose="article-image" onChange={(imageUrl) => setForm({ ...form, imageUrl })} help="Upload an article image to S3 or paste a publisher image URL." />
      <Field label="Excerpt"><input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></Field>
    </FormGrid>
  )
}
