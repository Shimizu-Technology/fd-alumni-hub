import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime } from '../../lib/datetime'
import { gameMatchupLabel } from '../../lib/games'
import { externalHref } from '../../lib/urls'
import type { Game, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, PaginationControls, Panel } from '../../components/ui'

const linksPageSize = 12
type LinkFilter = 'all' | 'missingTickets' | 'missingStreams' | 'missingEither' | 'complete'
type LinkSort = 'startAsc' | 'startDesc' | 'matchup' | 'tickets' | 'streams'
type LinkDraft = { ticketUrl: string; streamUrl: string }

export function AdminLinksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [drafts, setDrafts] = useState<Record<string, LinkDraft>>({})
  const [commonTicketUrl, setCommonTicketUrl] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LinkFilter>('all')
  const [sort, setSort] = useState<LinkSort>('startAsc')
  const [page, setPage] = useState(1)
  const focusGameId = searchParams.get('gameId') || ''
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, links] = await Promise.all([api.adminTournaments(), api.adminLinks(tournamentId || null)])
    return { tournaments: tournaments.tournaments, games: links.games, tournament: links.tournament }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  useEffect(() => {
    const next: Record<string, LinkDraft> = {}
    data?.games.forEach((game) => { next[game.id] = { ticketUrl: game.ticketUrl || '', streamUrl: game.streamUrl || '' } })
    setDrafts(next)
  }, [data?.games])

  useEffect(() => {
    setPage(1)
  }, [query, filter, sort, focusGameId, tournamentId])

  const visibleGames = useMemo(() => filterAndSortLinkGames(data?.games || [], drafts, query, filter, sort, focusGameId), [data?.games, drafts, query, filter, sort, focusGameId])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleGames.length / linksPageSize)))
  const pagedGames = useMemo(() => visibleGames.slice((currentPage - 1) * linksPageSize, currentPage * linksPageSize), [visibleGames, currentPage])
  const focusedGame = focusGameId ? (data?.games || []).find((game) => game.id === focusGameId) : null

  const clearFocus = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('gameId')
    setSearchParams(next, { replace: true })
  }

  const applyCommonTicketUrl = (mode: 'missing' | 'all') => {
    const normalizedUrl = externalHref(commonTicketUrl)
    if (!normalizedUrl) {
      setMessage('Paste a GuamTime ticket link first')
      return
    }

    let changed = 0
    const next = { ...drafts }
    for (const game of data?.games || []) {
      const existing = next[game.id] || { ticketUrl: game.ticketUrl || '', streamUrl: game.streamUrl || '' }
      if (mode === 'all' || !existing.ticketUrl) {
        if (existing.ticketUrl !== normalizedUrl) changed += 1
        next[game.id] = { ...existing, ticketUrl: normalizedUrl }
      }
    }
    setDrafts(next)
    setMessage(`${mode === 'all' ? 'Replaced' : 'Filled'} ticket links for ${changed} ${changed === 1 ? 'game' : 'games'}. Save changes to publish.`)
  }

  const save = async () => {
    const updates = (data?.games || [])
      .filter((game) => drafts[game.id] && (drafts[game.id].ticketUrl !== (game.ticketUrl || '') || drafts[game.id].streamUrl !== (game.streamUrl || '')))
      .map((game) => ({ id: game.id, ticketUrl: externalHref(drafts[game.id].ticketUrl), streamUrl: externalHref(drafts[game.id].streamUrl) }))

    if (!updates.length) {
      setMessage('No link changes to save')
      return
    }

    try {
      const response = await api.adminBulkLinks(updates)
      setMessage(`Saved ${response.updated} link updates`)
      await reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save links')
    }
  }

  if (loading && !data) return <LoadingState label="Loading links" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Ticket and stream links" description="Paste GuamTime ticket links and Clutch or partner stream links for each scheduled game." actions={<button className="btn primary" onClick={save}>Save changes</button>} />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <TicketBulkPanel value={commonTicketUrl} gamesCount={data?.games.length || 0} onChange={setCommonTicketUrl} onApply={applyCommonTicketUrl} />
      {message && <Panel className="notice-panel">{message}</Panel>}
      <Panel>
        <div className="section-heading">
          <div>
            <h2>Game links</h2>
            <p className="muted">Search, filter, and page through the schedule without losing unsaved link edits.</p>
          </div>
          <span>{visibleGames.length} of {data?.games.length || 0}</span>
        </div>
        {focusedGame && <div className="focused-filter-note"><span>Focused from Missing Links: {gameMatchupLabel(focusedGame)}</span><button className="btn secondary small" type="button" onClick={clearFocus}>Show all games</button></div>}
        <LinkToolbar query={query} filter={filter} sort={sort} onQueryChange={setQuery} onFilterChange={setFilter} onSortChange={setSort} />
        {!data?.games.length ? <EmptyState title="No games found" description="Create games before attaching ticket and stream links." /> : null}
        {data?.games.length && !visibleGames.length ? <EmptyState title="No games match those filters" description="Clear search, focus, or link filters to see more games." /> : null}
        {pagedGames.length > 0 && <div className="admin-list link-admin-list">{pagedGames.map((game) => <LinkRow key={game.id} game={game} value={drafts[game.id] || { ticketUrl: '', streamUrl: '' }} onChange={(value) => setDrafts((prev) => ({ ...prev, [game.id]: value }))} />)}</div>}
        <PaginationControls page={currentPage} pageSize={linksPageSize} total={visibleGames.length} onPageChange={setPage} />
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return <Panel className="toolbar-panel"><label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label></Panel>
}

function TicketBulkPanel({ value, gamesCount, onChange, onApply }: { value: string; gamesCount: number; onChange: (value: string) => void; onApply: (mode: 'missing' | 'all') => void }) {
  return (
    <Panel className="bulk-link-panel">
      <div className="section-heading compact-heading">
        <div>
          <h2>Common ticket link</h2>
          <p className="muted">Most games can share the same GuamTime link. Championship sessions or special events can be overridden row-by-row after applying.</p>
        </div>
        <span>{gamesCount} games</span>
      </div>
      <div className="bulk-ticket-actions">
        <Field label="GuamTime ticket URL"><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://guamtime.net/..." /></Field>
        <div className="row-actions">
          <button className="btn secondary" type="button" onClick={() => onApply('missing')}>Fill missing only</button>
          <button className="btn primary" type="button" onClick={() => onApply('all')}>Apply to all games</button>
        </div>
      </div>
      <p className="field-help">Ticket prices can vary by listing or session, so GuamTime remains the source of truth for current pricing before purchase.</p>
    </Panel>
  )
}

function LinkToolbar({ query, filter, sort, onQueryChange, onFilterChange, onSortChange }: { query: string; filter: LinkFilter; sort: LinkSort; onQueryChange: (value: string) => void; onFilterChange: (value: LinkFilter) => void; onSortChange: (value: LinkSort) => void }) {
  return (
    <div className="link-toolbar toolbar-panel">
      <label><span>Search games</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Team, date, bracket, link" /></label>
      <label><span>Link status</span><select value={filter} onChange={(event) => onFilterChange(event.target.value as LinkFilter)}><option value="all">All games</option><option value="missingTickets">Missing tickets</option><option value="missingStreams">Missing streams</option><option value="missingEither">Missing either link</option><option value="complete">Ticket and stream posted</option></select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as LinkSort)}><option value="startAsc">Start time · earliest</option><option value="startDesc">Start time · latest</option><option value="matchup">Matchup</option><option value="tickets">Ticket status</option><option value="streams">Stream status</option></select></label>
    </div>
  )
}

function LinkRow({ game, value, onChange }: { game: Game; value: LinkDraft; onChange: (value: LinkDraft) => void }) {
  return (
    <article className="admin-row-card link-admin-row">
      <div className="admin-row-head"><div><strong>{gameMatchupLabel(game)}</strong><span>{formatGuamDateTime(game.startTime)}</span></div></div>
      <FormGrid>
        <Field label="GuamTime ticket URL"><input value={value.ticketUrl} onChange={(event) => onChange({ ...value, ticketUrl: event.target.value })} /></Field>
        <Field label="Clutch / stream URL"><input value={value.streamUrl} onChange={(event) => onChange({ ...value, streamUrl: event.target.value })} /></Field>
      </FormGrid>
    </article>
  )
}

function filterAndSortLinkGames(games: Game[], drafts: Record<string, LinkDraft>, query: string, filter: LinkFilter, sort: LinkSort, focusGameId: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return games
    .filter((game) => {
      if (focusGameId) return game.id === focusGameId

      const draft = linkDraftForGame(game, drafts)
      const hasTicket = Boolean(draft.ticketUrl)
      const hasStream = Boolean(draft.streamUrl)
      const matchesFilter = filter === 'all' ||
        (filter === 'missingTickets' && !hasTicket) ||
        (filter === 'missingStreams' && !hasStream) ||
        (filter === 'missingEither' && (!hasTicket || !hasStream)) ||
        (filter === 'complete' && hasTicket && hasStream)
      if (!matchesFilter) return false

      const searchable = [ gameMatchupLabel(game), formatGuamDateTime(game.startTime), game.bracketCode || '', draft.ticketUrl, draft.streamUrl ].join(' ').toLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
    .slice()
    .sort((a, b) => compareLinkGames(a, b, sort, drafts))
}

function compareLinkGames(a: Game, b: Game, sort: LinkSort, drafts: Record<string, LinkDraft>) {
  if (sort === 'startDesc') return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  if (sort === 'matchup') return gameMatchupLabel(a).localeCompare(gameMatchupLabel(b), undefined, { numeric: true })
  if (sort === 'tickets') return linkStatusValue(a, drafts, 'ticketUrl') - linkStatusValue(b, drafts, 'ticketUrl') || new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  if (sort === 'streams') return linkStatusValue(a, drafts, 'streamUrl') - linkStatusValue(b, drafts, 'streamUrl') || new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
}

function linkStatusValue(game: Game, drafts: Record<string, LinkDraft>, key: keyof LinkDraft) {
  return linkDraftForGame(game, drafts)[key] ? 1 : 0
}

function linkDraftForGame(game: Game, drafts: Record<string, LinkDraft>) {
  return Object.prototype.hasOwnProperty.call(drafts, game.id)
    ? drafts[game.id]
    : { ticketUrl: game.ticketUrl || '', streamUrl: game.streamUrl || '' }
}
