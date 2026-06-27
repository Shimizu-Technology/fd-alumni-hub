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
type MissingCategory = 'all' | 'links' | 'tickets' | 'streams' | 'scores'
type MissingSort = 'startAsc' | 'startDesc' | 'matchup'
type MissingGap = { game: Game; missingTicket: boolean; missingStream: boolean; missingScore: boolean }

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

  const gaps = useMemo(() => buildMissingGaps(data?.missingTickets || [], data?.missingStreams || [], data?.missingScores || [], category), [data?.missingTickets, data?.missingStreams, data?.missingScores, category])

  if (loading && !data) return <LoadingState label="Checking data health" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournament = selectedTournament(data?.tournaments || [], tournamentId)

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Missing links and scores"
        description="Find games still missing GuamTime tickets, Clutch streams, or final scores. One game row now shows every missing field for that game."
        actions={<Link className="btn secondary" to={tournamentScopedPath('/admin/links', tournament?.id)}>Open Links page</Link>}
      />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournament?.id || ''} onChange={setTournamentId} />
      <div className="stats-grid three"><StatCard label="Missing tickets" value={data?.summary.missingTickets || 0} /><StatCard label="Missing streams" value={data?.summary.missingStreams || 0} /><StatCard label="Missing scores" value={data?.summary.missingScores || 0} tone="gold" /></div>
      <MissingToolbar query={query} category={category} sort={sort} onQueryChange={setQuery} onCategoryChange={setCategory} onSortChange={setSort} />
      <MissingPanel gaps={gaps} query={query} sort={sort} tournamentId={tournament?.id || ''} onSaved={reload} />
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
      <label><span>Category</span><select value={category} onChange={(event) => onCategoryChange(event.target.value as MissingCategory)}><option value="all">All gaps</option><option value="links">Links only</option><option value="tickets">Tickets only</option><option value="streams">Streams only</option><option value="scores">Scores only</option></select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as MissingSort)}><option value="startAsc">Start time · earliest</option><option value="startDesc">Start time · latest</option><option value="matchup">Matchup</option></select></label>
    </Panel>
  )
}

function MissingPanel({ gaps, query, sort, tournamentId, onSaved }: { gaps: MissingGap[]; query: string; sort: MissingSort; tournamentId: string; onSaved: () => Promise<void> }) {
  const [page, setPage] = useState(1)
  const visibleGaps = useMemo(() => filterAndSortMissingGaps(gaps, query, sort), [gaps, query, sort])
  const pagedGaps = useMemo(() => visibleGaps.slice((page - 1) * missingPageSize, page * missingPageSize), [visibleGaps, page])

  useEffect(() => {
    setPage(1)
  }, [query, sort, gaps])

  return (
    <Panel>
      <div className="section-heading"><div><h2>Games needing updates</h2><p className="muted">Ticket, stream, and score gaps are grouped by game to keep game-day cleanup compact.</p></div><span>{visibleGaps.length} of {gaps.length}</span></div>
      {gaps.length === 0 ? <EmptyState title="No gaps found" description="Ticket links, stream links, and final scores are complete for this filter." /> : null}
      {gaps.length > 0 && !visibleGaps.length ? <EmptyState title="No gaps match those filters" description="Clear search or change sorting to see more games." /> : null}
      {pagedGaps.length > 0 && (
        <div className="compact-list missing-gap-list">
          {pagedGaps.map((gap) => <MissingGameRow key={gap.game.id} gap={gap} tournamentId={tournamentId} onSaved={onSaved} />)}
        </div>
      )}
      <PaginationControls page={page} pageSize={missingPageSize} total={visibleGaps.length} onPageChange={setPage} />
    </Panel>
  )
}

function MissingGameRow({ gap, tournamentId, onSaved }: { gap: MissingGap; tournamentId: string; onSaved: () => Promise<void> }) {
  const { game } = gap
  const [ticketUrl, setTicketUrl] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [homeScore, setHomeScore] = useState(scoreDraft(game.homeScore))
  const [awayScore, setAwayScore] = useState(scoreDraft(game.awayScore))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const linksPath = tournamentScopedPath('/admin/links', tournamentId, { gameId: game.id })
  const gamesPath = tournamentScopedPath('/admin/games', tournamentId)

  useEffect(() => {
    setTicketUrl('')
    setStreamUrl('')
    setHomeScore(scoreDraft(game.homeScore))
    setAwayScore(scoreDraft(game.awayScore))
    setMessage('')
  }, [game.id, game.homeScore, game.awayScore, gap.missingTicket, gap.missingStream, gap.missingScore])

  const saveUpdates = async () => {
    const linkUpdate: { id: string; ticketUrl?: string | null; streamUrl?: string | null } = { id: game.id }
    let hasLinkUpdate = false

    if (gap.missingTicket && ticketUrl.trim()) {
      linkUpdate.ticketUrl = externalHref(ticketUrl)
      hasLinkUpdate = true
    }

    if (gap.missingStream && streamUrl.trim()) {
      linkUpdate.streamUrl = externalHref(streamUrl)
      hasLinkUpdate = true
    }

    const scoreChanged = gap.missingScore && (homeScore.trim() !== scoreDraft(game.homeScore) || awayScore.trim() !== scoreDraft(game.awayScore))
    const parsedHomeScore = parseScore(homeScore)
    const parsedAwayScore = parseScore(awayScore)

    if (scoreChanged && (parsedHomeScore === null || parsedAwayScore === null)) {
      setMessage('Enter both final scores as whole numbers before saving scores.')
      return
    }

    if (!hasLinkUpdate && !scoreChanged) {
      setMessage('Add at least one missing link or score before saving.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const requests: Array<Promise<unknown>> = []
      if (hasLinkUpdate) requests.push(api.adminBulkLinks([linkUpdate]))
      if (scoreChanged) requests.push(api.adminUpdateGame(game.id, { homeScore: parsedHomeScore, awayScore: parsedAwayScore, status: 'final' }))
      await Promise.all(requests)
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to save updates')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="compact-row missing-gap-row consolidated-gap-row">
      <div className="missing-gap-main">
        <span>{formatGuamDateTime(game.startTime)}</span>
        <strong>{gameMatchupLabel(game)}</strong>
        <small>{game.venue || DEFAULT_GAME_VENUE}{game.bracketCode ? ` · ${game.bracketCode}` : ''}</small>
        <div className="gap-chip-row">
          {gap.missingTicket && <span>Ticket link</span>}
          {gap.missingStream && <span>Stream link</span>}
          {gap.missingScore && <span>Final score</span>}
        </div>
      </div>
      <div className="missing-gap-actions consolidated-gap-actions">
        <div className="gap-field-grid">
          {gap.missingTicket && <Field label="GuamTime ticket URL"><input value={ticketUrl} onChange={(event) => setTicketUrl(event.target.value)} placeholder="https://..." /></Field>}
          {gap.missingStream && <Field label="Clutch / stream URL"><input value={streamUrl} onChange={(event) => setStreamUrl(event.target.value)} placeholder="https://..." /></Field>}
          {gap.missingScore && (
            <div className="score-gap-fields">
              <Field label={`Home score · ${game.homeTeam?.displayName || 'Home'}`}><input inputMode="numeric" pattern="[0-9]*" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} placeholder="0" /></Field>
              <Field label={`Away score · ${game.awayTeam?.displayName || 'Away'}`}><input inputMode="numeric" pattern="[0-9]*" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} placeholder="0" /></Field>
            </div>
          )}
        </div>
        <div className="row-actions">
          <button className="btn primary small" type="button" onClick={saveUpdates} disabled={saving}>{saving ? 'Saving' : 'Save updates'}</button>
          {(gap.missingTicket || gap.missingStream) && <Link className="btn secondary small" to={linksPath}>Open in Links</Link>}
          {gap.missingScore && <Link className="btn secondary small" to={gamesPath}>Open Games</Link>}
        </div>
        {message && <p className="form-error" role="alert">{message}</p>}
      </div>
    </article>
  )
}

function buildMissingGaps(missingTickets: Game[], missingStreams: Game[], missingScores: Game[], category: MissingCategory) {
  const gaps = new Map<string, MissingGap>()
  const ensureGap = (game: Game) => {
    const existing = gaps.get(game.id)
    if (existing) return existing

    const next = { game, missingTicket: false, missingStream: false, missingScore: false }
    gaps.set(game.id, next)
    return next
  }

  missingTickets.forEach((game) => { ensureGap(game).missingTicket = true })
  missingStreams.forEach((game) => { ensureGap(game).missingStream = true })
  missingScores.forEach((game) => { ensureGap(game).missingScore = true })

  return Array.from(gaps.values()).filter((gap) => {
    if (category === 'all') return true
    if (category === 'links') return gap.missingTicket || gap.missingStream
    if (category === 'tickets') return gap.missingTicket
    if (category === 'streams') return gap.missingStream
    return gap.missingScore
  })
}

function filterAndSortMissingGaps(gaps: MissingGap[], query: string, sort: MissingSort) {
  const normalizedQuery = query.trim().toLowerCase()
  return gaps
    .filter((gap) => {
      const { game } = gap
      const searchable = [ gameMatchupLabel(game), formatGuamDateTime(game.startTime), game.venue || '', game.bracketCode || '', gapLabel(gap) ].join(' ').toLowerCase()
      return !normalizedQuery || searchable.includes(normalizedQuery)
    })
    .slice()
    .sort((a, b) => compareMissingGames(a.game, b.game, sort))
}

function gapLabel(gap: MissingGap) {
  return [gap.missingTicket ? 'ticket GuamTime' : '', gap.missingStream ? 'stream Clutch' : '', gap.missingScore ? 'score final' : ''].filter(Boolean).join(' ')
}

function compareMissingGames(a: Game, b: Game, sort: MissingSort) {
  if (sort === 'startDesc') return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  if (sort === 'matchup') return gameMatchupLabel(a).localeCompare(gameMatchupLabel(b), undefined, { numeric: true })
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
}

function scoreDraft(score: number | null) {
  return score === null ? '' : String(score)
}

function parseScore(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number.parseInt(trimmed, 10)
}
