import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { formatGuamDateTime, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../lib/datetime'
import type { Game, Team, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

export function AdminGamesPage() {
  const [tournamentId, setTournamentId] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, teams, games] = await Promise.all([
      api.adminTournaments(),
      api.adminTeams(tournamentId || null),
      api.adminGames(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, teams: teams.teams, games: games.games }
  }, [tournamentId])

  if (loading && !data) return <LoadingState label="Loading games" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page">
      <PageHeader eyebrow="Admin" title="Games" description="Create games, update scores, and maintain ticket or stream links." />
      <TournamentFilter tournaments={data?.tournaments || []} value={tournamentId} onChange={setTournamentId} />
      <CreateGamePanel tournaments={data?.tournaments || []} teams={data?.teams || []} selectedTournamentId={tournamentId} onSaved={reload} />
      <Panel>
        <div className="section-heading"><h2>Game list</h2><span>{data?.games.length || 0} games</span></div>
        {!data?.games.length ? <EmptyState title="No games found" /> : (
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
      <label><span>Tournament</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All tournaments</option>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year} · {tournament.name}</option>)}</select></label>
    </Panel>
  )
}

function CreateGamePanel({ tournaments, teams, selectedTournamentId, onSaved }: { tournaments: Tournament[]; teams: Team[]; selectedTournamentId: string; onSaved: () => Promise<void> }) {
  const defaultTournamentId = selectedTournamentId || tournaments[0]?.id || ''
  const [form, setForm] = useState({ tournamentId: defaultTournamentId, homeTeamId: '', awayTeamId: '', startTime: '', venue: 'FD Phoenix Center', division: '', bracketCode: '', status: 'scheduled' as Game['status'] })
  const filteredTeams = useMemo(() => teams.filter((team) => !form.tournamentId || team.tournamentId === form.tournamentId), [teams, form.tournamentId])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await api.adminCreateGame({ ...form, startTime: guamLocalDateTimeInputToIso(form.startTime) })
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
      <form onSubmit={submit}>
        <FormGrid>
          <Field label="Tournament"><select value={form.tournamentId} onChange={(event) => setForm({ ...form, tournamentId: event.target.value })} required>{tournaments.map((tournament) => <option key={tournament.id} value={tournament.id}>{tournament.year}</option>)}</select></Field>
          <Field label="Away team"><select value={form.awayTeamId} onChange={(event) => setForm({ ...form, awayTeamId: event.target.value })} required><option value="">Select team</option>{filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.displayName}</option>)}</select></Field>
          <Field label="Home team"><select value={form.homeTeamId} onChange={(event) => setForm({ ...form, homeTeamId: event.target.value })} required><option value="">Select team</option>{filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.displayName}</option>)}</select></Field>
          <Field label="Start time (Guam)"><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></Field>
          <Field label="Venue"><input value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></Field>
          <Field label="Division"><input value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} /></Field>
        </FormGrid>
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Saving' : 'Create game'}</button>
      </form>
    </Panel>
  )
}

function EditableGame({ game, onSaved }: { game: Game; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    status: game.status,
    homeScore: game.homeScore?.toString() || '',
    awayScore: game.awayScore?.toString() || '',
    startTime: toLocalDateTimeInputValue(game.startTime),
    venue: game.venue || '',
    division: game.division || '',
    bracketCode: game.bracketCode || '',
    ticketUrl: game.ticketUrl || '',
    streamUrl: game.streamUrl || '',
    notes: game.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const save = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await api.adminUpdateGame(game.id, {
        ...form,
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
      <div className="admin-row-head"><div><strong>{game.awayTeam?.displayName} at {game.homeTeam?.displayName}</strong><span>{formatGuamDateTime(game.startTime)} · {game.venue || 'Venue TBD'}</span></div><StatusBadge status={game.status} /></div>
      <FormGrid>
        <Field label="Status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Game['status'] })}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="final">Final</option></select></Field>
        <Field label="Away score"><input type="number" value={form.awayScore} onChange={(event) => setForm({ ...form, awayScore: event.target.value })} /></Field>
        <Field label="Home score"><input type="number" value={form.homeScore} onChange={(event) => setForm({ ...form, homeScore: event.target.value })} /></Field>
        <Field label="Start"><input type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
        <Field label="Ticket URL"><input value={form.ticketUrl} onChange={(event) => setForm({ ...form, ticketUrl: event.target.value })} /></Field>
        <Field label="Stream URL"><input value={form.streamUrl} onChange={(event) => setForm({ ...form, streamUrl: event.target.value })} /></Field>
        <Field label="Division"><input value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} /></Field>
        <Field label="Bracket"><input value={form.bracketCode} onChange={(event) => setForm({ ...form, bracketCode: event.target.value })} /></Field>
      </FormGrid>
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <button className="btn secondary" onClick={save} disabled={saving}>{saving ? 'Saving' : 'Save game'}</button>
    </article>
  )
}
