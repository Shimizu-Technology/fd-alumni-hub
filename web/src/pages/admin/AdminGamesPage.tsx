import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, divisionNameById, gameResultLabel, teamDivision } from '../../lib/games'
import type { Division, Game, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const legacyPrefix = 'legacy:'

export function AdminGamesPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
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

  if (loading && !data) return <LoadingState label="Loading games" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const currentTournament = selectedTournament(tournaments, tournamentId)
  const divisions = data?.divisions || []

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Games and scores" description="Build the schedule, enter final scores, and attach GuamTime ticket links or Clutch stream links for each game. Final scores automatically refresh standings." />
      <TournamentFilter tournaments={tournaments} value={currentTournament?.id || ''} onChange={setTournamentId} />
      <CreateGamePanel tournament={currentTournament} teams={data?.teams || []} divisions={divisions} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Game list</h2><span>{data?.games.length || 0} games</span></div>
        {!data?.games.length ? <EmptyState title="No games found" description="Add teams first, then create each matchup in the schedule." /> : (
          <div className="admin-list">
            {data.games.map((game) => <EditableGame key={game.id} game={game} divisions={divisions} onSaved={reload} />)}
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

function CreateGamePanel({ tournament, teams, divisions, onSaved }: { tournament: Tournament | null; teams: Team[]; divisions: Division[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ homeTeamId: '', awayTeamId: '', startTime: '', divisionId: '', bracketCode: '', ticketUrl: '', streamUrl: '', status: 'scheduled' as Game['status'] })
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
        startTime: guamLocalDateTimeInputToIso(form.startTime),
        ...divisionAttrs,
      })
      setForm((current) => ({ ...current, homeTeamId: '', awayTeamId: '', startTime: '', divisionId: '', bracketCode: '', ticketUrl: '', streamUrl: '' }))
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
            <Field label="Start time (Guam)"><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></Field>
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
  const [form, setForm] = useState({
    status: game.status,
    homeScore: game.homeScore?.toString() || '',
    awayScore: game.awayScore?.toString() || '',
    startTime: toLocalDateTimeInputValue(game.startTime),
    divisionId: divisionValueFor(game, divisions),
    bracketCode: game.bracketCode || '',
    ticketUrl: game.ticketUrl || '',
    streamUrl: game.streamUrl || '',
    notes: game.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const scoreComplete = form.homeScore !== '' && form.awayScore !== ''
  const projectedResult = gameResultLabel({
    ...game,
    homeScore: form.homeScore === '' ? null : Number(form.homeScore),
    awayScore: form.awayScore === '' ? null : Number(form.awayScore),
  })

  const save = async (statusOverride?: Game['status']) => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateGame(game.id, {
        status: statusOverride || form.status,
        homeScore: form.homeScore === '' ? null : Number(form.homeScore),
        awayScore: form.awayScore === '' ? null : Number(form.awayScore),
        startTime: guamLocalDateTimeInputToIso(form.startTime),
        bracketCode: form.bracketCode,
        ticketUrl: form.ticketUrl || null,
        streamUrl: form.streamUrl || null,
        notes: form.notes || null,
        venue: game.venue || DEFAULT_GAME_VENUE,
        ...divisionPayload(form.divisionId, divisions),
      })
      await onSaved()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save game')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="admin-row-card">
      <div className="admin-row-head"><div><strong>{game.awayTeam?.displayName} at {game.homeTeam?.displayName}</strong><span>{formatGuamDateTime(game.startTime)} · {game.venue || DEFAULT_GAME_VENUE}</span></div><StatusBadge status={game.status} /></div>
      <FormGrid>
        <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Game['status'] })}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select></Field>
        <Field label="Away score"><input type="number" value={form.awayScore} onChange={(event) => setForm({ ...form, awayScore: event.target.value })} /></Field>
        <Field label="Home score"><input type="number" value={form.homeScore} onChange={(event) => setForm({ ...form, homeScore: event.target.value })} /></Field>
        <Field label="Start"><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
        <Field label="Ticket URL"><input value={form.ticketUrl} onChange={(event) => setForm({ ...form, ticketUrl: event.target.value })} /></Field>
        <Field label="Stream URL"><input value={form.streamUrl} onChange={(event) => setForm({ ...form, streamUrl: event.target.value })} /></Field>
        <Field label="Division"><DivisionSelect value={form.divisionId} divisions={divisions} currentName={game.division} onChange={(divisionId) => setForm({ ...form, divisionId })} /></Field>
        <Field label="Bracket"><input value={form.bracketCode} onChange={(event) => setForm({ ...form, bracketCode: event.target.value })} /></Field>
      </FormGrid>
      {projectedResult && <p className="form-note">{projectedResult}</p>}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <div className="row-actions">
        <button className="btn secondary" onClick={() => save()} disabled={saving}>{saving ? 'Saving' : 'Save game'}</button>
        <button className="btn primary" onClick={() => save('final')} disabled={saving || !scoreComplete}>{saving ? 'Saving' : 'Save final score'}</button>
      </div>
    </article>
  )
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
