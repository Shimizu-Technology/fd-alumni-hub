import { useAuthContext } from '../../contexts/AuthContext'
import { hasCapability } from '../../lib/adminModules'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { selectedTournament, tournamentScopedPath, useTournamentSelection } from '../../lib/admin'
import { formatGuamDate, formatGuamDateTime, toDateInputValue, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { AlertSeverity, Game, GameDayNote, PredictionPoll, Tournament, TournamentAlert } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const gameDayRefreshIntervalMs = 10_000

export function AdminGameDayPage() {
  const { user } = useAuthContext()
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [date, setDate] = useState('')
  const setup = useAsync(async () => {
    const [tournaments, games] = await Promise.all([
      api.adminTournaments("tonights_menu_and_news"),
      api.adminGames(tournamentId || null),
    ])
    return { tournaments: tournaments.tournaments, allGames: games.games }
  }, [tournamentId])
  const gameDayOptions = useMemo(() => scheduledGameDayOptions(setup.data?.allGames || []), [setup.data?.allGames])
  const gameDayQueryDate = date || gameDayOptions[0] || ''
  const gameDayState = useAsync(async () => {
    if (!tournamentId || !gameDayQueryDate) return emptyGameDayPayload(gameDayQueryDate)

    return api.adminGameDay({ tournamentId, date: gameDayQueryDate })
  }, [tournamentId, gameDayQueryDate])

  useEffect(() => {
    if (!tournamentId && setup.data?.tournaments[0]?.id) setTournamentId(setup.data.tournaments[0].id)
  }, [setup.data?.tournaments, tournamentId, setTournamentId])

  useEffect(() => {
    if (!date && gameDayOptions[0]) setDate(gameDayOptions[0])
  }, [date, gameDayOptions])

  useEffect(() => {
    if (!gameDayState.data || !gameDayQueryDate) return undefined

    const intervalId = window.setInterval(() => {
      void gameDayState.reload()
    }, gameDayRefreshIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [gameDayQueryDate, gameDayState.data, gameDayState.reload])

  if ((setup.loading && !setup.data) || (gameDayState.loading && !gameDayState.data)) return <LoadingState label="Loading game-day controls" />
  if (setup.error && !setup.data) return <ErrorState message={setup.error} onRetry={setup.reload} />
  if (gameDayState.error && !gameDayState.data) return <ErrorState message={gameDayState.error} onRetry={gameDayState.reload} />

  const tournaments = setup.data?.tournaments || []
  const tournament = selectedTournament(tournaments, tournamentId) || gameDayState.data?.tournament || null
  const scope = tournament ? { type: 'tournament', id: tournament.id } : undefined
  const canPublish = Boolean(tournament && hasCapability(user, 'tonights_menu_and_news', 'publish', scope))
  const canAlertSiteWide = hasCapability(user, 'tonights_menu_and_news', 'alert_site_wide', { type: 'site', id: '' })
  const gameDay = gameDayState.data
  const selectedDate = date || gameDay?.date || gameDayQueryDate || ''
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

      {canPublish ? <GameDayNoteForm tournament={tournament} date={selectedDate} note={gameDayNote} onSaved={gameDayState.reload} />
        : <Panel><h2>Tonight’s notes</h2>{gameDayNote
          ? <><p>{gameDayNote.foodMenu}</p><p>{gameDayNote.announcement}</p></>
          : <p>No notes for this date.</p>}</Panel>}
      <TournamentAlertsAdminPanel tournament={tournament} canPublish={canPublish} canAlertSiteWide={canAlertSiteWide} />
      {canPublish && <PredictionAdminPanel tournament={tournament} games={gameDay?.games || []} polls={gameDay?.predictionPolls || []} onSaved={gameDayState.reload} />}
    </div>
  )
}

function emptyGameDayPayload(date: string) {
  return { tournament: null as Tournament | null, date, gameDayNote: null as GameDayNote | null, games: [] as Game[], predictionPolls: [] as PredictionPoll[] }
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

function TournamentAlertsAdminPanel({ tournament, canPublish, canAlertSiteWide }: {
  tournament: Tournament | null
  canPublish: boolean
  canAlertSiteWide: boolean
}) {
  const { data, loading, error, reload } = useAsync(
    () => api.adminAlerts(tournament?.id || null),
    [tournament?.id],
  )

  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [scope, setScope] = useState<'tournament' | 'sitewide'>('tournament')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  const createAlert = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setFormError('')
    try {
      await api.adminCreateAlert({
        tournamentId: (!canPublish || canAlertSiteWide && scope === 'sitewide') ? null : (tournament?.id || null),
        severity,
        title: title.trim(),
        message: message.trim(),
        active: true,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setTitle('')
      setMessage('')
      setExpiresAt('')
      setNotice('Alert published')
      await reload()
    } catch (err) {
      setFormError(mutationErrorMessage(err, 'Unable to publish alert'))
    } finally {
      setSaving(false)
    }
  }

  const toggleAlert = async (alert: TournamentAlert) => {
    setFormError('')
    setNotice('')
    try {
      await api.adminUpdateAlert(alert.id, { active: !alert.active })
      setNotice(alert.active ? 'Alert hidden' : 'Alert activated')
      await reload()
    } catch (err) {
      setFormError(mutationErrorMessage(err, 'Unable to update alert'))
    }
  }

  const removeAlert = async (alert: TournamentAlert) => {
    if (!window.confirm(`Delete alert "${alert.title}"?`)) return
    setFormError('')
    setNotice('')
    try {
      await api.adminDeleteAlert(alert.id)
      setNotice('Alert deleted')
      await reload()
    } catch (err) {
      setFormError(mutationErrorMessage(err, 'Unable to delete alert'))
    }
  }

  const alerts = data?.alerts || []

  return (
    <Panel>
      <div className="section-heading">
        <h2>Site-wide storm &amp; schedule alerts</h2>
        {notice && <span role="status">{notice}</span>}
      </div>
      <p className="muted">Active alerts display immediately at the top of every public page for typhoon delays, power outages, or schedule changes.</p>

      {(canPublish || canAlertSiteWide) && <form onSubmit={createAlert} className="stacked-form">
        <FormGrid>
          <Field label="Severity">
            <select value={severity} onChange={(event) => setSeverity(event.target.value as AlertSeverity)}>
              <option value="info">Info</option>
              <option value="warning">Warning (Delay / Schedule)</option>
              <option value="urgent">Urgent (Storm / Power Outage)</option>
            </select>
          </Field>
          <Field label="Scope">
            <select value={canPublish ? scope : 'sitewide'} onChange={(event) => setScope(event.target.value as 'tournament' | 'sitewide')}>
              {canPublish && <option value="tournament">{tournament?.year} tournament</option>}
              {canAlertSiteWide && <option value="sitewide">Site-wide (all pages)</option>}
            </select>
          </Field>
          <Field label="Title">
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Typhoon delay — Games pushed 1 hour" required />
          </Field>
          <Field label="Auto-expire (optional)">
            <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </Field>
          <Field label="Message">
            <textarea rows={2} maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Check back at 6:00 PM for updated tip-off times at the Phoenix Center." required />
          </Field>
        </FormGrid>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Publish alert'}</button>
      </form>}

      {loading && !data ? (
        <LoadingState label="Loading alerts" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : alerts.length === 0 ? (
        <EmptyState title="No alerts posted" description="Publish a storm or schedule alert above whenever game-night plans change." />
      ) : (
        <div className="admin-list" style={{ marginTop: '1rem' }}>
          {alerts.map((alert) => (
            <article key={alert.id} className="admin-row-card">
              <div>
                <div className="game-card-top">
                  <span className={`tournament-alert-pill tournament-alert-pill--${alert.severity}`}>{alert.severity}</span>
                  <StatusBadge status={alert.active ? 'live' : 'cancelled'} />
                  <small className="muted">{alert.tournamentId ? 'Tournament alert' : 'Site-wide'}</small>
                </div>
                <strong>{alert.title}</strong>
                <p className="muted">{alert.message}</p>
                {alert.expiresAt && <small className="muted">Expires {formatGuamDateTime(alert.expiresAt)}</small>}
              </div>
              {(alert.tournamentId ? canPublish : canAlertSiteWide) && <div className="row-actions">
                <button type="button" className="btn secondary small" onClick={() => void toggleAlert(alert)}>
                  {alert.active ? 'Hide' : 'Activate'}
                </button>
                <button type="button" className="btn danger small" onClick={() => void removeAlert(alert)}>
                  Delete
                </button>
              </div>}
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}
