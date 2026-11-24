import { useAuthContext } from '../../contexts/AuthContext'
import { hasCapability } from '../../lib/adminModules'
import { Link, useSearchParams } from 'react-router-dom'
import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { tournamentScopedPath } from '../../lib/admin'
import { formatGuamDate, formatGuamDateTime, guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { AlertSeverity, Game, PredictionPoll, Tournament, TournamentAlert } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

import { GameNightDates } from '../../components/GameNightDates'
import { NightEditor } from './tonight/NightEditor'
import { UpdatesPanel } from './tonight/UpdatesPanel'
import { InfoGuideEditor } from './tonight/InfoGuideEditor'

const nightSections = [
  { key: 'menu', label: 'Menu & Spotlight' },
  { key: 'photos', label: 'Photos & Flyers' },
  { key: 'events', label: 'Events & Updates' },
  { key: 'alerts', label: 'Alerts & Guide' },
] as const
type NightSection = typeof nightSections[number]['key']

export function AdminGameDayPage() {
  const [search, setSearch] = useSearchParams()
  const tournamentId = search.get('tournamentId') || ''
  const date = search.get('date') || ''
  const setTournament = (id: string) => setSearch((current) => {
    const next = new URLSearchParams(current)
    next.set('tournamentId', id)
    next.delete('date')
    return next
  })
  const setDate = (value: string) => setSearch((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set('date', value)
    else next.delete('date')
    return next
  })
  const setup = useAsync(() => api.adminTournaments('tonights_menu_and_news'))
  if (setup.loading && !setup.data) return <LoadingState label="Loading tournaments" />
  if (setup.error) return <ErrorState message={setup.error} onRetry={setup.reload} />

  const tournaments = setup.data?.tournaments || []
  const tournament = tournaments.find((item) => item.id === tournamentId) ||
    tournaments.find((item) => item.status === 'live') || tournaments[0]
  if (!tournament) return <EmptyState title="No tournaments available" />

  return (
    <div className="page-stack admin-page">
      <PageHeader title="Tonight’s page" />
      <Panel className="toolbar-panel">
        <Field label="Tournament">
          <select value={tournament.id} onChange={(event) => setTournament(event.target.value)}>
            {tournaments.map((item) => <option key={item.id} value={item.id}>{item.year} · {item.name}</option>)}
          </select>
        </Field>
      </Panel>
      <TournamentNight key={tournament.id} tournament={tournament} date={date} setDate={setDate} />
    </div>
  )
}

function TournamentNight({ tournament, date, setDate }: { tournament: Tournament; date: string; setDate: (date: string) => void }) {
  const { user } = useAuthContext()
  const [section, setSection] = useState<NightSection>('menu')
  const scope = { type: 'tournament', id: tournament.id }
  const canEdit = hasCapability(user, 'tonights_menu_and_news', 'edit', scope)
  const canPublish = hasCapability(user, 'tonights_menu_and_news', 'publish', scope)
  const canAlertSiteWide = hasCapability(user, 'tonights_menu_and_news', 'alert_site_wide', { type: 'site', id: '' })
  const canEditGuide = canPublish || hasCapability(user, 'site_mode_and_settings', 'edit')
  const games = useAsync(() => api.adminGames(tournament.id), [tournament.id])
  const today = toLocalDateTimeInputValue(new Date().toISOString()).slice(0, 10)
  const gameDays = scheduledGameDayOptions(games.data?.games || [])
  const selectedDate = date || (tournament.status === 'live' ? today : gameDays.find((day) => day >= today) || today)
  const night = useAsync(() => api.adminGameDay({ tournamentId: tournament.id, date: selectedDate }), [tournament.id, selectedDate])
  const data = night.data?.date === selectedDate ? night.data : null

  if (games.loading && !games.data) return <LoadingState label="Loading schedule" />
  return (
    <>
      <Panel className="toolbar-panel game-day-toolbar-panel">
        <Field label="Game night (Guam)"><input type="date" value={selectedDate} onChange={(event) => setDate(event.target.value)} /></Field>
        <Link className="btn secondary" to={tournamentScopedPath('/today', tournament.id, { date: selectedDate })}>Open public night</Link>
        <GameNightDates dates={night.data?.scheduledDates ?? gameDays} selected={selectedDate} onSelect={setDate} />
        {games.error && <ErrorState message={games.error} onRetry={games.reload} />}
      </Panel>
      <div className="admin-section-tabs" role="tablist" aria-label="Tonight’s page sections">
        {nightSections.map(({ key, label }, index) => (
          <button
            type="button"
            role="tab"
            id={`night-tab-${key}`}
            className="admin-module-tab"
            aria-selected={key === section}
            aria-controls={key === 'alerts' ? 'night-panel-alerts' : 'night-panel-content'}
            tabIndex={key === section ? 0 : -1}
            key={key}
            onClick={() => setSection(key)}
            onKeyDown={(event) => {
              const last = nightSections.length - 1
              let nextIndex = -1
              if (event.key === 'ArrowRight') nextIndex = index === last ? 0 : index + 1
              else if (event.key === 'ArrowLeft') nextIndex = index === 0 ? last : index - 1
              else if (event.key === 'Home') nextIndex = 0
              else if (event.key === 'End') nextIndex = last
              if (nextIndex < 0) return
              event.preventDefault()
              const nextKey = nightSections[nextIndex].key
              setSection(nextKey)
              document.getElementById(`night-tab-${nextKey}`)?.focus()
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="night-panel-content" role="tabpanel" aria-labelledby={`night-tab-${section === 'alerts' ? 'menu' : section}`} hidden={section === 'alerts'}>
        {night.error ? <ErrorState message={night.error} onRetry={night.reload} /> : !data ? <LoadingState label="Loading game night" /> : (
          <NightEditor key={selectedDate} tournamentId={tournament.id} date={selectedDate} note={data.gameDayNote} canEdit={canEdit} canPublish={canPublish}
            section={section === 'alerts' ? 'menu' : section} onPreview={() => setSection('menu')} onSelectSection={setSection} />
        )}
      </div>
      {section === 'alerts' && !data && (
        night.error ? <ErrorState message={night.error} onRetry={night.reload} /> : <LoadingState label="Loading guide and polls" />
      )}
      <div className="page-stack" hidden={section !== 'events'}>
        <UpdatesPanel tournamentId={tournament.id} date={selectedDate} canEdit={canEdit} canPublish={canPublish} />
      </div>
      <div id="night-panel-alerts" role="tabpanel" aria-labelledby="night-tab-alerts" className="page-stack" hidden={section !== 'alerts'}>
        <TournamentAlertsAdminPanel tournament={tournament} canPublish={canPublish} canAlertSiteWide={canAlertSiteWide} />
        {data?.infoGuide && <InfoGuideEditor tournamentId={tournament.id} guide={data.infoGuide} canEdit={canEditGuide} />}
        {canPublish && <details><summary>Optional fan polls</summary>
          <PredictionAdminPanel tournament={tournament} games={data?.games || []} polls={data?.predictionPolls || []} onSaved={night.reload} />
        </details>}
      </div>
    </>
  )
}

function scheduledGameDayOptions(games: Game[]) {
  return Array.from(new Set(games.filter((game) => ['scheduled', 'live', 'final', 'delayed', 'postponed'].includes(game.status)).map((game) => toLocalDateTimeInputValue(game.startTime).slice(0, 10)).filter(Boolean))).sort()
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
        expiresAt: expiresAt ? guamLocalDateTimeInputToIso(expiresAt) : null,
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
      setNotice(alert.active ? 'Alert removed' : 'Alert activated')
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
        <h2>Post an urgent alert</h2>
        {notice && <span role="status">{notice}</span>}
      </div>
      <p className="muted">Use urgent alerts for typhoon delays, power outages, and sudden schedule changes. Choose who needs to see the banner.</p>

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
          <Field label="Expiry (Guam time, optional)">
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
                  <StatusBadge status={alertDisplayStatus(alert)} />
                  <small className="muted">{alert.tournamentId ? 'Tournament alert' : 'Site-wide'}</small>
                </div>
                <strong>{alert.title}</strong>
                <p className="muted">{alert.message}</p>
                {alert.expiresAt && <small className="muted">Expires {formatGuamDateTime(alert.expiresAt)}</small>}
              </div>
              {(alert.tournamentId ? canPublish : canAlertSiteWide) && <div className="row-actions">
                <button type="button" className={`btn small ${alert.active ? 'danger' : 'secondary'}`} onClick={() => void toggleAlert(alert)}>
                  {alert.active ? 'Remove alert' : 'Activate'}
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

function alertDisplayStatus(alert: TournamentAlert) {
  const now = Date.now()
  if (!alert.active) return 'removed'
  if (alert.expiresAt && Date.parse(alert.expiresAt) <= now) return 'expired'
  if (alert.startsAt && Date.parse(alert.startsAt) > now) return 'scheduled'
  return 'live'
}
