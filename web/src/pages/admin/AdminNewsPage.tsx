import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { formatGuamDate, toDateInputValue } from '../../lib/datetime'
import { gameOptionLabel } from '../../lib/games'
import { externalHref } from '../../lib/urls'
import type { Article, Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, PaginationControls, Panel } from '../../components/ui'
import { ImageUrlUploadField } from '../../components/admin/ImageUrlUploadField'
import { IconExternal } from '../../components/Icons'

const articlesPageSize = 8
type ArticleSort = 'publishedDesc' | 'publishedAsc' | 'title' | 'source'
type ArticleForm = { tournamentId: string; gameId: string; title: string; source: string; url: string; publishedAt: string; imageUrl: string; excerpt: string }

export function AdminNewsPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [articleQuery, setArticleQuery] = useState('')
  const [articleSort, setArticleSort] = useState<ArticleSort>('publishedDesc')
  const [page, setPage] = useState(1)
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, articles, games] = await Promise.all([api.adminTournaments(), api.adminArticles(tournamentId || null), api.adminGames(tournamentId || null)])
    return { tournaments: tournaments.tournaments, articles: articles.articles, games: games.games }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  useEffect(() => {
    setPage(1)
  }, [articleQuery, articleSort, tournamentId])

  const visibleArticles = useMemo(() => filterAndSortArticles(data?.articles || [], data?.games || [], articleQuery, articleSort), [data?.articles, data?.games, articleQuery, articleSort])
  const pagedArticles = useMemo(() => visibleArticles.slice((page - 1) * articlesPageSize, page * articlesPageSize), [visibleArticles, page])

  if (loading && !data) return <LoadingState label="Loading articles" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="News links" description="Create sourced article links, optionally attach them to a game, and publish them to the public coverage archive." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <CreateArticlePanel tournaments={data?.tournaments || []} games={data?.games || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        <div className="section-heading">
          <div>
            <h2>Articles</h2>
            <p className="muted">Preview images, search links, and expand only the article you need to edit.</p>
          </div>
          <span>{visibleArticles.length} of {data?.articles.length || 0}</span>
        </div>
        <ArticleToolbar query={articleQuery} sort={articleSort} onQueryChange={setArticleQuery} onSortChange={setArticleSort} />
        {!data?.articles.length ? <EmptyState title="No articles found" /> : null}
        {data?.articles.length && !visibleArticles.length ? <EmptyState title="No articles match those filters" description="Clear the search to see more coverage links." /> : null}
        {pagedArticles.length > 0 && <div className="admin-list article-admin-list">{pagedArticles.map((article) => <ArticleRow key={article.id} article={article} games={data?.games || []} onSaved={reload} />)}</div>}
        <PaginationControls page={page} pageSize={articlesPageSize} total={visibleArticles.length} onPageChange={setPage} />
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

function ArticleToolbar({ query, sort, onQueryChange, onSortChange }: { query: string; sort: ArticleSort; onQueryChange: (value: string) => void; onSortChange: (value: ArticleSort) => void }) {
  return (
    <div className="article-toolbar toolbar-panel">
      <label><span>Search articles</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Title, source, URL, excerpt" /></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as ArticleSort)}><option value="publishedDesc">Published · newest</option><option value="publishedAsc">Published · oldest</option><option value="title">Title</option><option value="source">Source</option></select></label>
    </div>
  )
}

function ArticleRow({ article, games, onSaved }: { article: Article; games: Game[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<ArticleForm>(articleFormState(article))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mutationError, setMutationError] = useState('')

  useEffect(() => {
    if (!editing) setForm(articleFormState(article))
  }, [article, editing])

  const save = async () => {
    setSaving(true)
    setMutationError('')
    try {
      await api.adminUpdateArticle(article.id, { ...form, gameId: form.gameId || null, publishedAt: form.publishedAt || null, imageUrl: form.imageUrl || null, excerpt: form.excerpt || null })
      setEditing(false)
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

  const cancel = () => {
    setForm(articleFormState(article))
    setEditing(false)
    setMutationError('')
  }

  return (
    <article className="admin-row-card article-admin-card">
      {!editing ? (
        <ArticleSummary article={article} onEdit={() => setEditing(true)} onDelete={remove} deleting={deleting} />
      ) : (
        <>
          <ArticleFields form={form} setForm={setForm} games={games} />
          <div className="row-actions"><button className="btn secondary" type="button" onClick={cancel} disabled={saving || deleting}>Cancel</button><button className="btn primary" type="button" onClick={save} disabled={saving || deleting}>{saving ? 'Saving' : 'Save article'}</button><button className="btn danger" type="button" onClick={remove} disabled={saving || deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div>
        </>
      )}
      {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
    </article>
  )
}

function ArticleSummary({ article, onEdit, onDelete, deleting }: { article: Article; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="article-summary-card">
      <ArticleImagePreview src={article.imageUrl} title={article.title} compact />
      <div className="article-summary-main">
        <span>{article.source}{article.publishedAt ? ` · ${formatGuamDate(article.publishedAt)}` : ' · Date pending'}</span>
        <h3>{article.title}</h3>
        <a href={externalHref(article.url) || undefined} target="_blank" rel="noreferrer">Open source <IconExternal size={14} /></a>
        {article.excerpt && <p>{article.excerpt}</p>}
        {article.game && <small>{gameOptionLabel(article.game)}</small>}
      </div>
      <div className="row-actions article-summary-actions"><button className="btn secondary small" type="button" onClick={onEdit}>Edit</button><button className="btn danger small" type="button" onClick={onDelete} disabled={deleting}>{deleting ? 'Deleting' : 'Delete'}</button></div>
    </div>
  )
}

function ArticleFields({ form, setForm, tournaments, games = [], includeTournament = false }: { form: ArticleForm; setForm: Dispatch<SetStateAction<ArticleForm>>; tournaments?: Tournament[]; games?: Game[]; includeTournament?: boolean }) {
  const availableGames = games.filter((game) => !form.tournamentId || game.tournamentId === form.tournamentId)

  return (
    <div className="article-fields-layout">
      <ArticleImagePreview src={form.imageUrl} title={form.title || 'Article image preview'} />
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
    </div>
  )
}

function ArticleImagePreview({ src, title, compact = false }: { src?: string | null; title: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const href = externalHref(src || '')
  if (!href || failed) return <div className={compact ? 'article-image-preview compact empty' : 'article-image-preview empty'}><span>{failed ? 'Image unavailable' : 'No image'}</span></div>

  return (
    <a className={compact ? 'article-image-preview compact' : 'article-image-preview'} href={href} target="_blank" rel="noreferrer" aria-label="Open article image">
      <img src={href} alt={title ? `${title} preview` : 'Article image preview'} loading="lazy" onError={() => setFailed(true)} />
    </a>
  )
}

function articleFormState(article: Article): ArticleForm {
  return { tournamentId: article.tournamentId, gameId: article.gameId || '', title: article.title, source: article.source, url: article.url, publishedAt: toDateInputValue(article.publishedAt), imageUrl: article.imageUrl || '', excerpt: article.excerpt || '' }
}

function filterAndSortArticles(articles: Article[], games: Game[], query: string, sort: ArticleSort) {
  const normalizedQuery = query.trim().toLowerCase()
  return articles
    .filter((article) => {
      const game = article.game || games.find((item) => item.id === article.gameId)
      const searchable = [ article.title, article.source, article.url, article.imageUrl || '', article.excerpt || '', game ? gameOptionLabel(game) : '' ].join(' ').toLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
    .slice()
    .sort((a, b) => compareArticles(a, b, sort))
}

function compareArticles(a: Article, b: Article, sort: ArticleSort) {
  if (sort === 'publishedAsc') return articleDateValue(a) - articleDateValue(b)
  if (sort === 'title') return a.title.localeCompare(b.title, undefined, { numeric: true })
  if (sort === 'source') return `${a.source} ${a.title}`.localeCompare(`${b.source} ${b.title}`, undefined, { numeric: true })
  return articleDateValue(b) - articleDateValue(a)
}

function articleDateValue(article: Article) {
  return article.publishedAt ? new Date(article.publishedAt).getTime() : 0
}
