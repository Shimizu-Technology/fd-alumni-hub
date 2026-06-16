import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { formatGuamDateTime, toDateInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { Game, GameDayNote, PredictionPoll, Tournament } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

export function AdminGameDayPage() {
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [date, setDate] = useState('')
  const { data, loading, error, reload } = useAsync(async () => {
    const [tournaments, gameDay] = await Promise.all([
      api.adminTournaments(),
      api.adminGameDay({ tournamentId: tournamentId || null, date: date || null }),
    ])
    return { tournaments: tournaments.tournaments, gameDay }
  }, [tournamentId, date])

  useEffect(() => {
    if (!tournamentId && data?.tournaments[0]?.id) setTournamentId(data.tournaments[0].id)
  }, [data?.tournaments, tournamentId, setTournamentId])

  useEffect(() => {
    if (!date && data?.gameDay.date) setDate(data.gameDay.date)
  }, [data?.gameDay.date, date])

  if (loading && !data) return <LoadingState label="Loading game-day controls" />
  if (error) return <ErrorState message={error} onRetry={reload} />

  const tournaments = data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId) || data?.gameDay.tournament || null
  const gameDay = data?.gameDay

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Admin"
        title="Game-day operations"
        description="Maintain Today at The Jungle notes, roster readiness, and lightweight prediction voting for the selected tournament day."
        actions={<Link className="btn secondary" to="/today">View Today page</Link>}
      />

      <Panel className="toolbar-panel">
        <label><span>Tournament</span><select value={tournament?.id || ''} onChange={(event) => setTournamentId(event.target.value)}>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.name}</option>)}</select></label>
        <label><span>Game day</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </Panel>

      <GameDayNoteForm tournament={tournament} date={date || gameDay?.date || ''} note={gameDay?.gameDayNote || null} onSaved={reload} />
      <PredictionAdminPanel tournament={tournament} games={gameDay?.games || []} polls={gameDay?.predictionPolls || []} onSaved={reload} />
    </div>
  )
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
  }, [note?.id, note?.updatedAt])

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

          {!games.length ? <EmptyState title="No games on selected date" description="Game prediction controls appear once games exist for this date." /> : games.map((game) => {
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
      <button className="btn secondary small" onClick={() => onUpdate(poll, { showResults: !poll.showResults })}>{poll.showResults ? 'Hide results' : 'Show results'}</button>
    </div>
  )
}
