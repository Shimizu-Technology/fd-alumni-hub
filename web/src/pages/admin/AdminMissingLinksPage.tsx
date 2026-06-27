import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, gameMatchupLabel } from '../../lib/games'
import { externalHref } from '../../lib/urls'
import type { Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, PaginationControls, Panel, StatCard } from '../../components/ui'

const missingPageSize = 8
type MissingCategory = 'all' | 'tickets' | 'streams' | 'scores'
type MissingSort = 'startAsc' | 'startDesc' | 'matchup'
type LinkKind = 'ticket' | 'stream'

export function AdminMissingLinksPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<MissingCategory>('all')
  const [sort, setSort] = useState<MissingSort>('startAsc')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, missing] = await Promise.all([api.adminTournaments(), api.adminMissingLinks(tournamentId || null)])
    return { tournaments: tournaments.tournaments, ...missing }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Checking data health" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Missing links and scores"
        description="Find games still missing GuamTime tickets, Clutch streams, or final scores. Add links here or jump to the full Links workspace."
        actions={<Link className="btn secondary" to={tournamentScopedPath('/admin/links', tournament?.id)}>Open Links page</Link>}
      />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <div className="stats-grid three"><StatCard label="Missing tickets" value={data?.summary.missingTickets || 0} /><StatCard label="Missing streams" value={data?.summary.missingStreams || 0} /><StatCard label="Missing scores" value={data?.summary.missingScores || 0} tone="gold" /></div>
      <MissingToolbar query={query} category={category} sort={sort} onQueryChange={setQuery} onCategoryChange={setCategory} onSortChange={setSort} />
      {(category === 'all' || category === 'tickets') && <MissingPanel title="Tickets missing" games={data?.missingTickets || []} query={query} sort={sort} linkKind="ticket" tournamentId={tournament?.id || ''} onSaved={reload} />}
      {(category === 'all' || category === 'streams') && <MissingPanel title="Streams missing" games={data?.missingStreams || []} query={query} sort={sort} linkKind="stream" tournamentId={tournament?.id || ''} onSaved={reload} />}
      {(category === 'all' || category === 'scores') && <MissingPanel title="Final scores missing" games={data?.missingScores || []} query={query} sort={sort} tournamentId={tournament?.id || ''} onSaved={reload} />}
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function MissingToolbar({ query, category, sort, onQueryChange, onCategoryChange, onSortChange }: { query: string; category: MissingCategory; sort: MissingSort; onQueryChange: (value: string) => void; onCategoryChange: (value: MissingCategory) => void; onSortChange: (value: MissingSort) => void }) {
  return (
    <Panel className="missing-toolbar toolbar-panel">
      <label><span>Search games</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Team, date, bracket, venue" /></label>
      <label><span>Category</span><select value={category} onChange={(event) => onCategoryChange(event.target.value as MissingCategory)}><option value="all">All gaps</option><option value="tickets">Tickets only</option><option value="streams">Streams only</option><option value="scores">Scores only</option></select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as MissingSort)}><option value="startAsc">Start time · earliest</option><option value="startDesc">Start time · latest</option><option value="matchup">Matchup</option></select></label>
    </Panel>
  )
}

function MissingPanel({ title, games, query, sort, linkKind, tournamentId, onSaved }: { title: string; games: Game[]; query: string; sort: MissingSort; linkKind?: LinkKind; tournamentId: string; onSaved: () => Promise<void> }) {
  const [page, setPage] = useState(1)
  const visibleGames = useMemo(() => filterAndSortMissingGames(games, query, sort), [games, query, sort])
  const pagedGames = useMemo(() => visibleGames.slice((page - 1) * missingPageSize, page * missingPageSize), [visibleGames, page])

  useEffect(() => {
    setPage(1)
  }, [query, sort, games])

  return (
    <Panel>
      <div className="section-heading"><h2>{title}</h2><span>{visibleGames.length} of {games.length}</span></div>
      {games.length === 0 ? <EmptyState title="Nothing missing in this category" /> : null}
      {games.length > 0 && !visibleGames.length ? <EmptyState title="No gaps match those filters" description="Clear search or change sorting to see more games." /> : null}
      {pagedGames.length > 0 && (
        <div className="compact-list missing-gap-list">
          {pagedGames.map((game) => <MissingGameRow key={game.id} game={game} linkKind={linkKind} tournamentId={tournamentId} onSaved={onSaved} />)}
        </div>
      )}
      <PaginationControls page={page} pageSize={missingPageSize} total={visibleGames.length} onPageChange={setPage} />
    </Panel>
  )
}

function MissingGameRow({ game, linkKind, tournamentId, onSaved }: { game: Game; linkKind?: LinkKind; tournamentId: string; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const linkLabel = linkKind === 'ticket' ? 'GuamTime ticket URL' : 'Clutch / stream URL'
  const linksPath = tournamentScopedPath('/admin/links', tournamentId, { gameId: game.id })
  const gamesPath = tournamentScopedPath('/admin/games', tournamentId)

  const saveLink = async () => {
    const normalized = externalHref(value)
    if (!normalized || !linkKind) {
      setMessage('Paste a valid link first')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      await api.adminBulkLinks([linkKind === 'ticket' ? { id: game.id, ticketUrl: normalized } : { id: game.id, streamUrl: normalized }])
      setValue('')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save link')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="compact-row missing-gap-row">
      <div className="missing-gap-main">
        <span>{formatGuamDateTime(game.startTime)}</span>
        <strong>{gameMatchupLabel(game)}</strong>
        <small>{game.venue || DEFAULT_GAME_VENUE}{game.bracketCode ? ` · ${game.bracketCode}` : ''}</small>
      </div>
      {linkKind ? (
        <div className="missing-gap-actions">
          <Field label={linkLabel}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://..." /></Field>
          <div className="row-actions">
            <button className="btn primary small" type="button" onClick={saveLink} disabled={saving}>{saving ? 'Saving' : 'Save link'}</button>
            <Link className="btn secondary small" to={linksPath}>Open in Links</Link>
          </div>
          {message && <p className="form-error" role="alert">{message}</p>}
        </div>
      ) : (
        <div className="row-actions"><Link className="btn secondary small" to={gamesPath}>Open Games page</Link></div>
      )}
    </article>
  )
}

function filterAndSortMissingGames(games: Game[], query: string, sort: MissingSort) {
  const normalizedQuery = query.trim().toLowerCase()
  return games
    .filter((game) => {
      const searchable = [ gameMatchupLabel(game), formatGuamDateTime(game.startTime), game.venue || '', game.bracketCode || '' ].join(' ').toLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
    .slice()
    .sort((a, b) => compareMissingGames(a, b, sort))
}

function compareMissingGames(a: Game, b: Game, sort: MissingSort) {
  if (sort === 'startDesc') return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  if (sort === 'matchup') return gameMatchupLabel(a).localeCompare(gameMatchupLabel(b), undefined, { numeric: true })
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
}
