import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, divisionNameById, gameResultLabel, teamDivision } from '../../lib/games'
import type { Division, Game, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const legacyPrefix = 'legacy:'
const commonTipoffTimes = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30']
type GameSortOption = 'startAsc' | 'startDesc' | 'matchup' | 'status'

export function AdminGamesPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [gameQuery, setGameQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('')
  const [gameSort, setGameSort] = useState<GameSortOption>('startAsc')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams, games, divisions] = await Promise.all([
      api.adminTournaments(),
      api.adminTeams(tournamentId || null),
      api.adminGames(tournamentId || null),
      api.adminDivisions(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, teams: teams.teams, games: games.games, divisions: divisions.divisions }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  const tournaments = data?.tournaments || []
  const currentTournament = selectedTournament(tournaments, tournamentId)
  const divisions = data?.divisions || []
  const games = data?.games || []
  const visibleGames = useMemo(() => filterAndSortGames(games, gameQuery, statusFilter, divisionFilter, gameSort), [games, gameQuery, statusFilter, divisionFilter, gameSort])
  const divisionOptions = useMemo(() => Array.from(new Set([ ...divisions.map((division) => division.name), ...games.map((game) => game.division).filter((division): division is string => Boolean(division)) ])).sort((a, b) => a.localeCompare(b)), [divisions, games])

  if (loading && !data) return <LoadingState label="Loading games" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Games and scores" description="Build the schedule, enter final scores, and attach GuamTime ticket links or Clutch stream links for each game. Final scores automatically refresh standings." />
      <TournamentFilter tournaments={tournaments} value={currentTournament?.id || ''} onChange={setTournamentId} />
      <CreateGamePanel tournament={currentTournament} teams={data?.teams || []} divisions={divisions} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Game list</h2><span>{visibleGames.length} of {games.length} games</span></div>
        <GameToolbar query={gameQuery} status={statusFilter} division={divisionFilter} sort={gameSort} divisions={divisionOptions} onQueryChange={setGameQuery} onStatusChange={setStatusFilter} onDivisionChange={setDivisionFilter} onSortChange={setGameSort} />
        {!games.length ? <EmptyState title="No games found" description="Add teams first, then create each matchup in the schedule." /> : null}
        {games.length > 0 && !visibleGames.length ? <EmptyState title="No games match those filters" description="Clear the search or status filter to see more games." /> : null}
        {visibleGames.length > 0 && (
          <div className="admin-list game-admin-list">
            {visibleGames.map((game) => <EditableGame key={game.id} game={game} divisions={divisions} onSaved={reload} />)}
          </div>
        )}
      </Panel>
    </div>
  )
}

function TournamentFilter({ tournaments, value, onChange }: { tournaments: Tournament[]; value: string; onChange: (value: string) => void }) {
  return (
    <Panel className="toolbar-panel">
      <label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label>
    </Panel>
  )
}

function GameToolbar({ query, status, division, sort, divisions, onQueryChange, onStatusChange, onDivisionChange, onSortChange }: { query: string; status: string; division: string; sort: GameSortOption; divisions: string[]; onQueryChange: (value: string) => void; onStatusChange: (value: string) => void; onDivisionChange: (value: string) => void; onSortChange: (value: GameSortOption) => void }) {
  return (
    <div className="game-toolbar toolbar-panel">
      <label><span>Search games</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Team, bracket, ticket, stream" /></label>
      <label><span>Status</span><select value={status} onChange={(event) => onStatusChange(event.target.value)}><option value="">All statuses</option><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select></label>
      <label><span>Division</span><select value={division} onChange={(event) => onDivisionChange(event.target.value)}><option value="">All divisions</option>{divisions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => onSortChange(event.target.value as GameSortOption)}><option value="startAsc">Start time · earliest</option><option value="startDesc">Start time · latest</option><option value="matchup">Matchup</option><option value="status">Status</option></select></label>
    </div>
  )
}

function CreateGamePanel({ tournament, teams, divisions, onSaved }: { tournament: Tournament | null; teams: Team[]; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ homeTeamId: '', awayTeamId: '', startDate: guamTodayInputValue(), startTime: '18:30', divisionId: '', bracketCode: '', ticketUrl: '', streamUrl: '', status: 'scheduled' as Game['status'] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const availableTeams = useMemo(() => teams.filter((team) => !tournament || team.tournamentId === tournament.id), [teams, tournament])

  useEffect(() => {
    setForm((current) => ({ ...current, homeTeamId: '', awayTeamId: '', divisionId: '' }))
  }, [tournament?.id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!tournament) {
      setMessage('Select a tournament before creating a game')
      return
    }

    const divisionAttrs = form.divisionId ? divisionPayload(form.divisionId, divisions) : derivedDivisionPayload(form.homeTeamId, form.awayTeamId, availableTeams)

    setSaving(true)
    try {
      await api.adminCreateGame({
        tournamentId: tournament.id,
        homeTeamId: form.homeTeamId,
        awayTeamId: form.awayTeamId,
        status: form.status,
        venue: DEFAULT_GAME_VENUE,
        bracketCode: form.bracketCode,
        ticketUrl: form.ticketUrl || null,
        streamUrl: form.streamUrl || null,
        startTime: guamLocalDateTimeInputToIso(`${form.startDate}T${form.startTime}`),
        ...divisionAttrs,
      })
      setForm((current) => ({ ...current, homeTeamId: '', awayTeamId: '', startTime: '18:30', divisionId: '', bracketCode: '', ticketUrl: '', streamUrl: '' }))
      setMessage('Game created')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create game')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="section-heading"><h2>Add game</h2>{message && <span>{message}</span>}</div>
      {!tournament ? <EmptyState title="Choose a tournament first" /> : (
        <form onSubmit={submit}>
          <p className="form-note">Tournament: {tournament.year}. Venue defaults to {DEFAULT_GAME_VENUE}.</p>
          <FormGrid>
            <Field label="Away team"><select value={form.awayTeamId} onChange={(event) => setForm({ ...form, awayTeamId: event.target.value })} required><option value="">Select team</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.displayName}</option>)}</select></Field>
            <Field label="Home team"><select value={form.homeTeamId} onChange={(event) => setForm({ ...form, homeTeamId: event.target.value })} required><option value="">Select team</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.displayName}</option>)}</select></Field>
            <Field label="Game date (Guam)"><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></Field>
            <Field label="Tipoff time"><select value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required>{commonTipoffTimes.map((time) => <option key={time} value={time}>{timeLabel(time)}</option>)}</select><small className="field-help">Guam time. Use game details after creation for unusual times.</small></Field>
            <Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} onChange={(divisionId) => setForm({ ...form, divisionId })} /></Field>
            <Field label="Bracket / round"><input value={form.bracketCode} onChange={(event) => setForm({ ...form, bracketCode: event.target.value })} placeholder="Pool A, Semifinal, Final" /></Field>
            <Field label="Ticket URL"><input value={form.ticketUrl} onChange={(event) => setForm({ ...form, ticketUrl: event.target.value })} placeholder="GuamTime link" /></Field>
            <Field label="Stream URL"><input value={form.streamUrl} onChange={(event) => setForm({ ...form, streamUrl: event.target.value })} placeholder="Clutch or partner stream" /></Field>
          </FormGrid>
          <button className="btn primary" type="submit" disabled={saving || availableTeams.length < 2}>{saving ? 'Saving' : 'Create game'}</button>
        </form>
      )}
    </Panel>
  )
}

function EditableGame({ game, divisions, onSaved }: { game: Game; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(gameFormState(game, divisions))
  const [editingDetails, setEditingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const scoreComplete = form.homeScore !== '' && form.awayScore !== ''
  const detailsDirty = gameDetailsChanged(form, game, divisions)
  const projectedResult = gameResultLabel({
    ...game,
    homeScore: form.homeScore === '' ? null : Number(form.homeScore),
    awayScore: form.awayScore === '' ? null : Number(form.awayScore),
  })

  useEffect(() => {
    setForm(gameFormState(game, divisions))
  }, [game, divisions])

  const saveScores = async (statusOverride?: Game['status']) => {
    if (detailsDirty) {
      setEditingDetails(true)
      setSaveError('Save or cancel game detail changes before saving scores.')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      const nextStatus = statusOverride || form.status
      await api.adminUpdateGame(game.id, {
        status: nextStatus,
        homeScore: form.homeScore === '' ? null : Number(form.homeScore),
        awayScore: form.awayScore === '' ? null : Number(form.awayScore),
      })
      if (statusOverride) setForm((current) => ({ ...current, status: statusOverride }))
      await onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save score')
    } finally {
      setSaving(false)
    }
  }

  const saveDetails = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateGame(game.id, {
        status: form.status,
        startTime: guamLocalDateTimeInputToIso(form.startTime),
        bracketCode: form.bracketCode,
        ticketUrl: form.ticketUrl || null,
        streamUrl: form.streamUrl || null,
        notes: form.notes || null,
        venue: game.venue || DEFAULT_GAME_VENUE,
        ...divisionPayload(form.divisionId, divisions),
      })
      setEditingDetails(false)
      await onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save game details')
    } finally {
      setSaving(false)
    }
  }

  const cancelDetails = () => {
    setForm(gameFormState(game, divisions))
    setEditingDetails(false)
    setSaveError('')
  }

  return (
    <article className="admin-row-card game-admin-card">
      <div className="admin-row-head">
        <div>
          <strong>{game.awayTeam?.displayName} at {game.homeTeam?.displayName}</strong>
          <span>{formatGuamDateTime(game.startTime)} · {game.venue || DEFAULT_GAME_VENUE}</span>
        </div>
        <StatusBadge status={game.status} />
      </div>

      <GameDetailsSummary game={game} />

      <div className="score-entry-panel" aria-label={`Score entry for ${game.awayTeam?.displayName} at ${game.homeTeam?.displayName}`}>
        <FormGrid>
          <Field label="Away score"><input type="number" value={form.awayScore} onChange={(event) => setForm({ ...form, awayScore: event.target.value })} /></Field>
          <Field label="Home score"><input type="number" value={form.homeScore} onChange={(event) => setForm({ ...form, homeScore: event.target.value })} /></Field>
        </FormGrid>
        {projectedResult && <p className="form-note">{projectedResult}</p>}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <div className="row-actions">
          <button className="btn secondary" onClick={() => saveScores()} disabled={saving}>{saving ? 'Saving' : 'Save scores'}</button>
          <button className="btn primary" onClick={() => saveScores('final')} disabled={saving || !scoreComplete}>{saving ? 'Saving' : 'Save final score'}</button>
          <button className="btn secondary" type="button" onClick={() => setEditingDetails((value) => !value)} aria-expanded={editingDetails}>{editingDetails ? 'Hide game details' : 'Edit game details'}</button>
        </div>
      </div>

      {editingDetails && (
        <div className="game-detail-editor">
          <div className="section-heading compact-heading"><h3>Game details</h3><span>Schedule, links, status</span></div>
          <FormGrid>
            <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Game['status'] })}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select></Field>
            <Field label="Start"><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
            <Field label="Ticket URL"><input value={form.ticketUrl} onChange={(event) => setForm({ ...form, ticketUrl: event.target.value })} /></Field>
            <Field label="Stream URL"><input value={form.streamUrl} onChange={(event) => setForm({ ...form, streamUrl: event.target.value })} /></Field>
            <Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} currentName={game.division} onChange={(divisionId) => setForm({ ...form, divisionId })} /></Field>
            <Field label="Bracket"><input value={form.bracketCode} onChange={(event) => setForm({ ...form, bracketCode: event.target.value })} /></Field>
          </FormGrid>
          <div className="row-actions">
            <button className="btn secondary" type="button" onClick={cancelDetails} disabled={saving}>Cancel</button>
            <button className="btn primary" type="button" onClick={saveDetails} disabled={saving}>{saving ? 'Saving' : 'Save game details'}</button>
          </div>
        </div>
      )}
    </article>
  )
}

function GameDetailsSummary({ game }: { game: Game }) {
  return (
    <dl className="game-detail-summary">
      <div><dt>Division</dt><dd>{game.division || 'Use team division'}</dd></div>
      <div><dt>Bracket</dt><dd>{game.bracketCode || 'Not set'}</dd></div>
      <div><dt>Tickets</dt><dd>{game.ticketUrl ? <a href={game.ticketUrl} target="_blank" rel="noreferrer">Open ticket link</a> : 'Not posted'}</dd></div>
      <div><dt>Stream</dt><dd>{game.streamUrl ? <a href={game.streamUrl} target="_blank" rel="noreferrer">Open stream link</a> : 'Not posted'}</dd></div>
    </dl>
  )
}

function gameDetailsChanged(form: ReturnType<typeof gameFormState>, game: Game, divisions: Division[]) {
  const persisted = gameFormState(game, divisions)

  return form.status !== persisted.status ||
    form.startTime !== persisted.startTime ||
    form.divisionId !== persisted.divisionId ||
    form.bracketCode !== persisted.bracketCode ||
    form.ticketUrl !== persisted.ticketUrl ||
    form.streamUrl !== persisted.streamUrl ||
    form.notes !== persisted.notes
}

function gameFormState(game: Game, divisions: Division[]) {
  return {
    status: game.status,
    homeScore: game.homeScore?.toString() || '',
    awayScore: game.awayScore?.toString() || '',
    startTime: toLocalDateTimeInputValue(game.startTime),
    divisionId: divisionValueFor(game, divisions),
    bracketCode: game.bracketCode || '',
    ticketUrl: game.ticketUrl || '',
    streamUrl: game.streamUrl || '',
    notes: game.notes || '',
  }
}

function DivisionSelect({ value, divisions, currentName, onChange }: { value: string; divisions: Division[]; currentName?: string | null; onChange: (value: string) => void }) {
  const hasCurrentName = currentName && !divisions.some((division) => division.name === currentName)
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Use team division</option>
      {divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}
      {hasCurrentName && <option value={`${legacyPrefix}${currentName}`}>{currentName} (not in current division settings)</option>}
    </select>
  )
}

function divisionValueFor(game: Game, divisions: Division[]) {
  if (game.divisionId) return game.divisionId
  const matchingDivision = divisions.find((division) => division.name === game.division)
  if (matchingDivision) return matchingDivision.id
  return game.division ? `${legacyPrefix}${game.division}` : ''
}

function divisionPayload(value: string, divisions: Division[]) {
  if (!value) return { divisionId: null, division: null }
  if (value.startsWith(legacyPrefix)) return { divisionId: null, division: value.slice(legacyPrefix.length) }

  return { divisionId: value, division: divisionNameById(value, divisions) || null }
}

function derivedDivisionPayload(homeTeamId: string, awayTeamId: string, teams: Team[]) {
  const homeTeam = teams.find((team) => team.id === homeTeamId)
  const awayTeam = teams.find((team) => team.id === awayTeamId)
  const sourceTeam = homeTeam?.division ? homeTeam : awayTeam?.division ? awayTeam : null

  return { divisionId: sourceTeam?.divisionId || null, division: sourceTeam ? teamDivision(sourceTeam.id, teams) || null : null }
}

function guamTodayInputValue() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Pacific/Guam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function timeLabel(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const twelveHour = hour % 12 || 12
  return `${twelveHour}:${String(minute).padStart(2, '0')} ${period}`
}

function filterAndSortGames(games: Game[], query: string, status: string, division: string, sort: GameSortOption) {
  const normalizedQuery = query.trim().toLowerCase()
  return games
    .filter((game) => {
      const searchable = [
        game.awayTeam?.displayName,
        game.homeTeam?.displayName,
        game.division,
        game.bracketCode,
        game.ticketUrl,
        game.streamUrl,
      ].filter(Boolean).join(' ').toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
      const matchesStatus = !status || game.status === status
      const matchesDivision = !division || game.division === division
      return matchesQuery && matchesStatus && matchesDivision
    })
    .slice()
    .sort((a, b) => compareGames(a, b, sort))
}

function compareGames(a: Game, b: Game, sort: GameSortOption) {
  if (sort === 'startDesc') return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  if (sort === 'matchup') return gameMatchup(a).localeCompare(gameMatchup(b), undefined, { numeric: true })
  if (sort === 'status') return `${a.status} ${gameMatchup(a)}`.localeCompare(`${b.status} ${gameMatchup(b)}`, undefined, { numeric: true })
  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
}

function gameMatchup(game: Game) {
  return `${game.awayTeam?.displayName || ''} at ${game.homeTeam?.displayName || ''}`
}
