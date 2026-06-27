import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { formatGuamDate, formatGuamDateTime, toDateInputValue, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { Game, GameDayNote, PredictionPoll, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const gameDayRefreshIntervalMs = 10_000

export function AdminGameDayPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [date, setDate] = useState('')
  const setup = useAsync(async () => {
    const [tournaments, games] = await Promise.all([
      api.adminTournaments(),
      api.adminGames(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, allGames: games.games }
  }, [tournamentId])
  const gameDayState = useAsync(() => api.adminGameDay({ tournamentId: tournamentId || null, date: date || null }), [tournamentId, date])

  useEffect(() => {
    if (!tournamentId && setup.data?.tournaments[0]?.id) setTournamentId(setup.data.tournaments[0].id)
  }, [setup.data?.tournaments, tournamentId, setTournamentId])

  const gameDayOptions = useMemo(() => scheduledGameDayOptions(setup.data?.allGames || []), [setup.data?.allGames])

  useEffect(() => {
    if (!date) setDate(gameDayOptions[0] || gameDayState.data?.date || '')
  }, [gameDayState.data?.date, date, gameDayOptions])

  useEffect(() => {
    if (!gameDayState.data) return undefined

    const intervalId = window.setInterval(() => {
      void gameDayState.reload()
    }, gameDayRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [gameDayState.data, gameDayState.reload])

  if ((setup.loading && !setup.data) || (gameDayState.loading && !gameDayState.data)) return <LoadingState label="Loading game-day controls" />
  if (setup.error && !setup.data) return <ErrorState message={setup.error} onRetry={setup.reload} />
  if (gameDayState.error && !gameDayState.data) return <ErrorState message={gameDayState.error} onRetry={gameDayState.reload} />

  const tournaments = setup.data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId) || gameDayState.data?.tournament || null
  const gameDay = gameDayState.data
  const selectedDate = date || gameDay?.date || ''
  const gameDayNote = gameDay?.date === selectedDate ? gameDay?.gameDayNote || null : null

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Game-day operations"
        description="Maintain Today at The Jungle notes, roster readiness, and lightweight prediction voting for the selected tournament day."
        actions={<Link className="btn secondary" to="/today">View Today page</Link>}
      />

      <Panel className="toolbar-panel game-day-toolbar-panel">
        <label><span>Tournament</span><select value={tournament?.id || ''} onChange={(event) => setTournamentId(event.target.value)}>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.name}</option>)}</select></label>
        <label><span>Game day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        {gameDayOptions.length > 0 && (
          <div className="game-day-date-jump" aria-label="Scheduled game-day shortcuts">
            {gameDayOptions.map((option) => <button key={option} type="button" className={option === selectedDate ? 'selected' : ''} onClick={() => setDate(option)}>{formatGuamDate(option, { weekday: 'short', year: undefined })}</button>)}
          </div>
        )}
      </Panel>

      <GameDayNoteForm tournament={tournament} date={selectedDate} note={gameDayNote} onSaved={gameDayState.reload} />
      <PredictionAdminPanel tournament={tournament} games={gameDay?.games || []} polls={gameDay?.predictionPolls || []} onSaved={gameDayState.reload} />
    </div>
  )
}

function scheduledGameDayOptions(games: Game[]) {
  return Array.from(new Set(games.map((game) => toLocalDateTimeInputValue(game.startTime).slice(0, 10)).filter(Boolean))).sort()
}

function GameDayNoteForm({ tournament, date, note, onSaved }: { tournament: Tournament | null; date: string; note: GameDayNote | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ hostClass: '', foodMenu: '', announcement: '', sponsorShoutout: '', active: true })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setForm({
      hostClass: note?.hostClass || '',
      foodMenu: note?.foodMenu || '',
      announcement: note?.announcement || '',
      sponsorShoutout: note?.sponsorShoutout || '',
      active: note?.active ?? true,
    })
  }, [date, note?.id, note?.updatedAt])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      if (!tournament) throw new Error('Choose a tournament first')
      await api.adminSaveGameDayNote({ tournamentId: tournament.id, date: toDateInputValue(date), ...form })
      setMessage('Game-day note saved')
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to save game-day note'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="section-heading"><h2>Today page facts</h2>{message && <span>{message}</span>}</div>
      <form onSubmit={submit}>
        <FormGrid>
          <Field label="Host class"><input value={form.hostClass} onChange={(event) => setForm({ ...form, hostClass: event.target.value })} placeholder="Class of 2006" /></Field>
          <Field label="Food / menu"><input value={form.foodMenu} onChange={(event) => setForm({ ...form, foodMenu: event.target.value })} placeholder="BBQ, drinks, concessions" /></Field>
          <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Show on public Today page</label>
          <Field label="Announcement"><textarea value={form.announcement} onChange={(event) => setForm({ ...form, announcement: event.target.value })} placeholder="Parking, tipoff, door, or schedule notes" rows={3} /></Field>
          <Field label="Sponsor shoutout"><textarea value={form.sponsorShoutout} onChange={(event) => setForm({ ...form, sponsorShoutout: event.target.value })} placeholder="Optional sponsor or partner note" rows={3} /></Field>
        </FormGrid>
        <button className="btn primary" type="submit" disabled={saving || !date}>{saving ? 'Saving' : 'Save Today info'}</button>
      </form>
    </Panel>
  )
}

function PredictionAdminPanel({ tournament, games, polls, onSaved }: { tournament: Tournament | null; games: Game[]; polls: PredictionPoll[]; onSaved: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const tournamentPoll = polls.find((poll) => poll.pollType === 'tournament')
  const gamePolls = useMemo(() => new Map(polls.filter((poll) => poll.pollType === 'game' && poll.gameId).map((poll) => [poll.gameId!, poll])), [polls])

  const createPoll = async (payload: Partial<PredictionPoll>) => {
    setMessage('')
    try {
      await api.adminCreatePredictionPoll(payload)
      setMessage('Prediction poll opened')
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to create prediction poll'))
    }
  }

  const updatePoll = async (poll: PredictionPoll, payload: Partial<PredictionPoll>) => {
    setMessage('')
    try {
      await api.adminUpdatePredictionPoll(poll.id, payload, poll.tournamentId)
      setMessage('Prediction poll updated')
      await onSaved()
    } catch (err) {
      setMessage(mutationErrorMessage(err, 'Unable to update prediction poll'))
    }
  }

  return (
    <Panel>
      <div className="section-heading"><h2>Predictions</h2>{message && <span>{message}</span>}</div>
      {!tournament ? <EmptyState title="Choose a tournament first" /> : (
        <div className="admin-prediction-stack">
          <article className="admin-row-card prediction-admin-row">
            <div>
              <strong>Tournament winner poll</strong>
              <p className="muted">A no-sign-in fan vote for the overall champion.</p>
            </div>
            {tournamentPoll ? <PredictionPollControls poll={tournamentPoll} onUpdate={updatePoll} /> : <button className="btn secondary" onClick={() => createPoll({ tournamentId: tournament.id, pollType: 'tournament', question: 'Who wins the tournament?' })}>Open tournament poll</button>}
          </article>

          {!games.length ? <EmptyState title="No games on selected date" description="Use a game-day shortcut above or choose a date with scheduled games." /> : games.map((game) => {
            const poll = gamePolls.get(game.id)
            return (
              <article className="admin-row-card prediction-admin-row" key={game.id}>
                <div>
                  <strong>{game.awayTeam?.displayName || 'Away team'} at {game.homeTeam?.displayName || 'Home team'}</strong>
                  <p className="muted">{formatGuamDateTime(game.startTime)} · {game.venue || DEFAULT_GAME_VENUE}</p>
                </div>
                {poll ? <PredictionPollControls poll={poll} onUpdate={updatePoll} /> : <button className="btn secondary" onClick={() => createPoll({ tournamentId: tournament.id, gameId: game.id, pollType: 'game', question: 'Who wins this game?' })}>Open game poll</button>}
              </article>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function PredictionPollControls({ poll, onUpdate }: { poll: PredictionPoll; onUpdate: (poll: PredictionPoll, payload: Partial<PredictionPoll>) => Promise<void> }) {
  return (
    <div className="prediction-admin-controls">
      <StatusBadge status={poll.status} />
      <span className="muted">{poll.totalVotes ?? 0} votes</span>
      <button className="btn secondary small" onClick={() => onUpdate(poll, { status: poll.status === 'open' ? 'closed' : 'open' })}>{poll.status === 'open' ? 'Close voting' : 'Reopen voting'}</button>
    </div>
  )
}
