import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE, divisionOptions, gameResultLabel, teamDivision } from '../../lib/games'
import type { Game, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

export function AdminGamesPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams, games] = await Promise.all([
      api.adminTournaments(),
      api.adminTeams(tournamentId || null),
      api.adminGames(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, teams: teams.teams, games: games.games }
  }, [tournamentId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  if (loading && !data) return <LoadingState label="Loading games" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const currentTournament = selectedTournament(tournaments, tournamentId)
  const divisions = divisionOptions(data?.teams || [], data?.games || [])

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Games and scores" description="Build the schedule, enter final scores, and attach GuamTime ticket links or Clutch stream links for each game. Final scores automatically refresh standings." />
      <TournamentFilter tournaments={tournaments} value={currentTournament?.id || ''} onChange={setTournamentId} />
      <datalist id="division-options">{divisions.map((division) => <option key={division} value={division} />)}</datalist>
      <CreateGamePanel tournament={currentTournament} teams={data?.teams || []} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Game list</h2><span>{data?.games.length || 0} games</span></div>
        {!data?.games.length ? <EmptyState title="No games found" description="Add teams first, then create each matchup in the schedule." /> : (
          <div className="admin-list">
            {data.games.map((game) => <EditableGame key={game.id} game={game} onSaved={reload} />)}
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

function CreateGamePanel({ tournament, teams, onSaved }: { tournament: Tournament | null; teams: Team[]; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ homeTeamId: '', awayTeamId: '', startTime: '', division: '', bracketCode: '', ticketUrl: '', streamUrl: '', status: 'scheduled' as Game['status'] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const availableTeams = useMemo(() => teams.filter((team) => !tournament || team.tournamentId === tournament.id), [teams, tournament])

  useEffect(() => {
    setForm((current) => ({ ...current, homeTeamId: '', awayTeamId: '', division: '' }))
  }, [tournament?.id])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (!tournament) {
      setMessage('Select a tournament before creating a game')
      return
    }

    setSaving(true)
    try {
      await api.adminCreateGame({
        ...form,
        tournamentId: tournament.id,
        venue: DEFAULT_GAME_VENUE,
        division: form.division || teamDivision(form.homeTeamId, availableTeams) || teamDivision(form.awayTeamId, availableTeams) || null,
        ticketUrl: form.ticketUrl || null,
        streamUrl: form.streamUrl || null,
        startTime: guamLocalDateTimeInputToIso(form.startTime),
      })
      setForm((current) => ({ ...current, homeTeamId: '', awayTeamId: '', startTime: '', bracketCode: '', ticketUrl: '', streamUrl: '' }))
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
            <Field label="Division"><input list="division-options" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} placeholder="Derives from team if blank" /></Field>
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

function EditableGame({ game, onSaved }: { game: Game; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    status: game.status,
    homeScore: game.homeScore?.toString() || '',
    awayScore: game.awayScore?.toString() || '',
    startTime: toLocalDateTimeInputValue(game.startTime),
    venue: game.venue || DEFAULT_GAME_VENUE,
    division: game.division || '',
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
        ...form,
        status: statusOverride || form.status,
        homeScore: form.homeScore === '' ? null : Number(form.homeScore),
        awayScore: form.awayScore === '' ? null : Number(form.awayScore),
        startTime: guamLocalDateTimeInputToIso(form.startTime),
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
        <Field label="Division"><input list="division-options" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} /></Field>
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
