import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { toDateInputValue } from '../../lib/datetime'
import type { Article, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel } from '../../components/ui'

type ArticleForm = { tournamentId: string; title: string; source: string; url: string; publishedAt: string; imageUrl: string; excerpt: string }

export function AdminNewsPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, articles] = await Promise.all([api.adminTournaments(), api.adminArticles(tournamentId || null)])
    return { tournaments: tournaments.tournaments, articles: articles.articles }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading articles" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="News links" description="Create and edit sourced article links for the public coverage archive." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <CreateArticlePanel tournaments={data?.tournaments || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        {!data?.articles.length ? <EmptyState title="No articles found" /> : <div className="admin-list">{data.articles.map((article) => <ArticleRow key={article.id} article={article} onSaved={reload} />)}</div>}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function CreateArticlePanel({ tournaments, selectedTournamentId, onSaved }: { tournaments: Tournament[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ tournamentId: selectedTournamentId || tournaments[0]?.id || '', title: '', source: 'GSPN', url: '', publishedAt: '', imageUrl: '', excerpt: '' })
  const [message, setMessage] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await api.adminCreateArticle({ ...form, publishedAt: form.publishedAt || null, imageUrl: form.imageUrl || null, excerpt: form.excerpt || null })
      setForm({ ...form, title: '', url: '', imageUrl: '', excerpt: '' })
      setMessage('Article created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create article')
    }
  }

  return <Panel><div className="section-heading"><h2>Add article</h2>{message && <span>{message}</span>}</div><form onSubmit={submit}><ArticleFields form={form} setForm={setForm} tournaments={tournaments} includeTournament /><button className="btn primary" type="submit">Create article</button></form></Panel>
}

function ArticleRow({ article, onSaved }: { article: Article; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ArticleForm>({ tournamentId: article.tournamentId, title: article.title, source: article.source, url: article.url, publishedAt: toDateInputValue(article.publishedAt), imageUrl: article.imageUrl || '', excerpt: article.excerpt || '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const save = async () => {
    setSaving(true)
    setMutationError('')
    try {
      await api.adminUpdateArticle(article.id, { ...form, publishedAt: form.publishedAt || null, imageUrl: form.imageUrl || null, excerpt: form.excerpt || null })
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

  return <article className="admin-row-card"><ArticleFields form={form} setForm={setForm} />{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="row-actions"><button className="btn secondary" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save'}</button><button className="btn danger" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div></article>
}

function ArticleFields({ form, setForm, tournaments, includeTournament = false }: { form: ArticleForm; setForm: Dispatch<SetStateAction<ArticleForm>>; tournaments?: Tournament[]; includeTournament?: boolean }) {
  return <FormGrid>{includeTournament && tournaments && <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>}<Field label="Title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field><Field label="Source"><input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} required /></Field><Field label="URL"><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required /></Field><Field label="Published"><input type="date" value={form.publishedAt} onChange={(event) => setForm({ ...form, publishedAt: event.target.value })} /></Field><Field label="Image URL"><input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></Field><Field label="Excerpt"><input value={form.excerpt} onChange={(event) => setForm({ ...form, excerpt: event.target.value })} /></Field></FormGrid>
}
