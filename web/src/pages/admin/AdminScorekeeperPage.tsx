import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { selectedTournament, useTournamentSelection } from '../../lib/admin'
import { formatGuamDateTime, toLocalDateTimeInputValue } from '../../lib/datetime'
import { DEFAULT_GAME_VENUE } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import {
  dismissQueueItem,
  enqueueScoreMutation,
  flushScoreQueue,
  readScoreQueue,
  resolveConflictKeepMine,
  resolveConflictUseServer,
  type QueuedScoreItem,
  type ScoreMutationPayload,
} from '../../lib/scoreQueue'
import type { Game, GameStatus } from '../../lib/types'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

type ScoreFilter = 'today' | 'live' | 'all'

export function AdminScorekeeperPage() {
  const auth = useAuthContext()
  const userId = auth.user?.id || 'anonymous'
  const isStaff = Boolean(auth.user?.isStaff)
  const [tournamentId, setTournamentId] = useTournamentSelection()
  const [filter, setFilter] = useState<ScoreFilter>('today')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [queue, setQueue] = useState<QueuedScoreItem[]>(() => readScoreQueue(userId))
  const [gameOverrides, setGameOverrides] = useState<Record<string, Game>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncBanner, setSyncBanner] = useState('')
  const syncingRef = useRef(false)
  const flushAgainRef = useRef(false)
  const flushForceRef = useRef(false)

  const { data, loading, error, reload } = useAsync(async () => {
    const [tournamentsRes, gamesRes] = await Promise.all([
      api.adminTournaments(),
      api.adminGames(tournamentId || null),
    ])
    return {
      tournaments: tournamentsRes.tournaments,
      games: gamesRes.games,
    }
  }, [tournamentId])

  useEffect(() => {
    setQueue(readScoreQueue(userId))
  }, [userId])

  useEffect(() => {
    if (!tournamentId && data?.tournaments.length) {
      const preferred =
        data.tournaments.find((t) => t.status === 'live') ||
        data.tournaments.find((t) => t.status === 'upcoming') ||
        data.tournaments[0]
      if (preferred) setTournamentId(preferred.id)
    }
  }, [data?.tournaments, tournamentId, setTournamentId])

  const runFlush = useCallback(async (force = false) => {
    if (syncingRef.current) {
      flushAgainRef.current = true
      if (force) flushForceRef.current = true
      return
    }
    const current = readScoreQueue(userId)
    if (current.length === 0) {
      setQueue([])
      return
    }

    syncingRef.current = true
    setSyncing(true)
    let nextForce = force
    let totalSynced = 0
    try {
      while (true) {
        flushAgainRef.current = false
        flushForceRef.current = false

        const result = await flushScoreQueue(
          userId,
          (gameId, body) => api.adminScoreGame(gameId, body),
          { force: nextForce },
        )
        setQueue(result.remaining)

        if (result.syncedGames.length > 0) {
          totalSynced += result.syncedGames.length
          setGameOverrides((prev) => {
            const next = { ...prev }
            for (const synced of result.syncedGames) {
              next[synced.id] = synced
            }
            return next
          })
        }

        if (result.pausedForAuth) break
        if (flushAgainRef.current || result.hasNewerPending) {
          nextForce = flushForceRef.current || result.hasNewerPending
          continue
        }
        break
      }

      if (totalSynced > 0) {
        setSyncBanner(`Synced ${totalSynced} score ${totalSynced === 1 ? 'update' : 'updates'}.`)
        await reload()
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [userId, reload])

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true)
      void runFlush(true)
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [runFlush])

  const authPaused = queue.some((item) => item.state === 'paused_auth')

  useEffect(() => {
    const hasPending = queue.some((item) => item.state === 'pending')
    if (!hasPending || !isOnline || authPaused) return undefined

    const timer = window.setInterval(() => {
      void runFlush(false)
    }, 5_000)

    return () => window.clearInterval(timer)
  }, [queue, isOnline, authPaused, runFlush])

  const tournaments = data?.tournaments || []
  const visibleTournaments = useMemo(() => {
    if (isStaff) return tournaments
    return tournaments.filter((t) => t.status === 'live' || t.status === 'upcoming')
  }, [tournaments, isStaff])

  const currentTournament = selectedTournament(tournaments, tournamentId)
  const queueByGameId = useMemo(() => new Map(queue.map((item) => [item.gameId, item])), [queue])
  const todayGuamKey = toLocalDateTimeInputValue(new Date().toISOString()).slice(0, 10)

  const games = useMemo(() => {
    return (data?.games || []).map((g) => {
      const override = gameOverrides[g.id]
      if (!override) return g
      return (override.lockVersion ?? 0) >= (g.lockVersion ?? 0) ? override : g
    })
  }, [data?.games, gameOverrides])
  const filteredGames = useMemo(() => {
    if (filter === 'live') {
      return games.filter((g) => g.status === 'live' || g.status === 'delayed')
    }
    if (filter === 'today') {
      const todayList = games.filter((g) => toLocalDateTimeInputValue(g.startTime).slice(0, 10) === todayGuamKey)
      return todayList.length > 0 ? todayList : games
    }
    return games
  }, [games, filter, todayGuamKey])

  const handleQueueAndFlush = async (gameId: string, payload: ScoreMutationPayload) => {
    setSyncBanner('')
    const updated = enqueueScoreMutation(userId, gameId, payload)
    setQueue(updated)
    if (authPaused) {
      setSyncBanner('Session expired — score queued locally. Sign in and tap Sync now.')
    } else if (isOnline) {
      await runFlush(false)
    } else {
      setSyncBanner('Saved offline — will sync automatically when connection returns.')
    }
  }

  const handleUseServer = async (gameId: string) => {
    setQueue(resolveConflictUseServer(userId, gameId))
    await reload()
  }

  const handleKeepMine = async (gameId: string, serverLockVersion?: number) => {
    setQueue(resolveConflictKeepMine(userId, gameId, serverLockVersion))
    await runFlush(true)
  }

  const handleDismiss = (gameId: string) => {
    setQueue(dismissQueueItem(userId, gameId))
  }

  const authPausedItem = queue.find((item) => item.state === 'paused_auth')
  const pendingCount = queue.filter((item) => item.state === 'pending' || item.state === 'paused_auth').length

  if (loading && !data) return <LoadingState label="Loading scorekeeper console" />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />

  return (
    <div className="page-stack admin-page scorekeeper-page">
      <PageHeader
        eyebrow="Game Night · Scorekeeper"
        title="Live score entry"
        description="Mobile-first scoring with offline retry protection. Live taps save instantly without blocking on standings; finalizing pool games refreshes standings automatically."
      />

      <Panel className="scorekeeper-status-bar">
        <div className="scorekeeper-status-indicators">
          <span className={`status-badge ${isOnline ? 'status-live' : 'status-delayed'}`}>
            {isOnline ? 'Online' : 'Offline — queuing locally'}
          </span>
          {pendingCount > 0 && (
            <span className="division-pill">{pendingCount} pending {pendingCount === 1 ? 'sync' : 'syncs'}</span>
          )}
          {syncBanner && <span role="status" className="muted">{syncBanner}</span>}
        </div>
        <div className="row-actions">
          <button type="button" className="btn secondary small" onClick={() => void runFlush(true)} disabled={syncing || queue.length === 0}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
          <button type="button" className="btn secondary small" onClick={() => void reload()} disabled={loading}>
            Refresh games
          </button>
        </div>
      </Panel>

      {authPausedItem && (
        <div className="panel tournament-alert-banner tournament-alert-banner--urgent" role="alert">
          <span className="tournament-alert-pill tournament-alert-pill--urgent">Auth</span>
          <div className="tournament-alert-copy">
            <strong>Session expired — sign in again to sync pending scores.</strong>
            <p>Your pending score updates are safely stored on this device. Refresh or sign in, then tap Sync now.</p>
          </div>
        </div>
      )}

      <Panel className="toolbar-panel scorekeeper-toolbar">
        <label>
          <span>Tournament</span>
          <select value={currentTournament?.id || ''} onChange={(event) => setTournamentId(event.target.value)}>
            {(visibleTournaments.length > 0 ? visibleTournaments : tournaments).map((t) => (
              <option key={t.id} value={t.id}>{t.year} · {t.name} ({t.status})</option>
            ))}
          </select>
        </label>
        <div className="scorekeeper-filter-pills" role="group" aria-label="Game filter">
          {([
            ['today', 'Today'],
            ['live', 'Live / Delayed'],
            ['all', `All (${games.length})`],
          ] as Array<[ScoreFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={`bracket-pill-btn${filter === key ? ' active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </Panel>

      {!filteredGames.length ? (
        <EmptyState title="No games to score" description="Switch the filter to All or select an active tournament." />
      ) : (
        <div className="scorekeeper-card-list">
          {filteredGames.map((game) => (
            <ScorekeeperGameCard
              key={game.id}
              game={game}
              tournamentStatus={currentTournament?.status || 'live'}
              isStaff={isStaff}
              queuedItem={queueByGameId.get(game.id)}
              onSubmit={handleQueueAndFlush}
              onUseServer={handleUseServer}
              onKeepMine={handleKeepMine}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScorekeeperGameCard({
  game,
  tournamentStatus,
  isStaff,
  queuedItem,
  onSubmit,
  onUseServer,
  onKeepMine,
  onDismiss,
}: {
  game: Game
  tournamentStatus: string
  isStaff: boolean
  queuedItem?: QueuedScoreItem
  onSubmit: (gameId: string, payload: ScoreMutationPayload) => Promise<void>
  onUseServer: (gameId: string) => Promise<void>
  onKeepMine: (gameId: string, serverLockVersion?: number) => Promise<void>
  onDismiss: (gameId: string) => void
}) {
  const [awayScore, setAwayScore] = useState<number>(() => queuedItem?.payload.awayScore ?? game.awayScore ?? 0)
  const [homeScore, setHomeScore] = useState<number>(() => queuedItem?.payload.homeScore ?? game.homeScore ?? 0)
  const [status, setStatus] = useState<GameStatus>(() => queuedItem?.payload.status ?? game.status)
  const [statusNote, setStatusNote] = useState<string>(() => queuedItem?.payload.statusNote ?? game.statusNote ?? '')

  useEffect(() => {
    if (queuedItem && (queuedItem.state === 'pending' || queuedItem.state === 'paused_auth' || queuedItem.state === 'conflict')) {
      return
    }
    setAwayScore(game.awayScore ?? 0)
    setHomeScore(game.homeScore ?? 0)
    setStatus(game.status)
    setStatusNote(game.statusNote ?? '')
  }, [game.id, game.lockVersion, game.homeScore, game.awayScore, game.status, game.statusNote, queuedItem])

  const tournamentLocked = !isStaff && tournamentStatus !== 'live' && tournamentStatus !== 'upcoming'
  const finalLocked = !isStaff && game.status === 'final'
  const conflictLocked = queuedItem?.state === 'conflict'
  const readOnly = tournamentLocked || finalLocked || conflictLocked

  const clamp = (n: number) => Math.max(0, Math.min(300, Math.round(n)))

  const sendUpdate = async (overrides: Partial<ScoreMutationPayload> = {}) => {
    if (readOnly) return
    const nextHome = overrides.homeScore !== undefined ? overrides.homeScore : homeScore
    const nextAway = overrides.awayScore !== undefined ? overrides.awayScore : awayScore
    const nextStatus = overrides.status ?? status
    const nextNote = overrides.statusNote !== undefined ? overrides.statusNote : (statusNote.trim() || null)

    if (nextStatus === 'final' && game.status !== 'final') {
      const ok = window.confirm(
        `Finalize ${game.awayTeam?.displayName || 'Away'} (${nextAway}) at ${game.homeTeam?.displayName || 'Home'} (${nextHome})?${!isStaff ? ' Scorekeepers cannot edit after finalizing.' : ''}`,
      )
      if (!ok) return
    }

    await onSubmit(game.id, {
      homeScore: nextHome,
      awayScore: nextAway,
      status: nextStatus,
      statusNote: nextNote,
      lockVersion: game.lockVersion,
    })
  }

  const bump = (side: 'away' | 'home', delta: number) => {
    if (readOnly) return
    const nextAway = side === 'away' ? clamp(awayScore + delta) : awayScore
    const nextHome = side === 'home' ? clamp(homeScore + delta) : homeScore
    const nextStatus: GameStatus = status === 'scheduled' ? 'live' : status
    setAwayScore(nextAway)
    setHomeScore(nextHome)
    setStatus(nextStatus)
    void sendUpdate({ awayScore: nextAway, homeScore: nextHome, status: nextStatus })
  }

  const canKeepMineOnConflict =
    isStaff || (queuedItem?.serverGame?.status !== 'final')

  return (
    <article className={`panel scorekeeper-card${queuedItem ? ' scorekeeper-card--queued' : ''}`}>
      <div className="scorekeeper-card-head">
        <div>
          <strong>{game.awayTeam?.displayName || 'Away'} at {game.homeTeam?.displayName || 'Home'}</strong>
          <small className="muted">
            {formatGuamDateTime(game.startTime)} · {game.venue || DEFAULT_GAME_VENUE}
            {game.gameNumber ? ` · #${game.gameNumber}` : ''}
            {game.division ? ` · ${game.division}` : ''}
          </small>
        </div>
        <StatusBadge status={status} />
      </div>

      {(tournamentLocked || finalLocked) && (
        <p className="muted" role="note">
          {tournamentLocked
            ? 'Read-only: scorekeepers can only score live or upcoming tournaments.'
            : 'Finalized — ask tournament staff or an admin if a score correction is needed.'}
        </p>
      )}

      <div className="scorekeeper-scoreboard">
        <div className="scorekeeper-team-col">
          <span className="scorekeeper-team-label">{game.awayTeam?.displayName || 'Away'}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={300}
            aria-label={`${game.awayTeam?.displayName || 'Away'} score`}
            className="scorekeeper-score-input"
            value={awayScore}
            disabled={readOnly}
            onChange={(e) => setAwayScore(clamp(Number(e.target.value || 0)))}
          />
          <div className="scorekeeper-tap-row">
            {([1, 2, 3, -1] as const).map((delta) => (
              <button
                key={delta}
                type="button"
                className="btn secondary scorekeeper-tap-btn"
                disabled={readOnly}
                onClick={() => bump('away', delta)}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        <div className="scorekeeper-team-col">
          <span className="scorekeeper-team-label">{game.homeTeam?.displayName || 'Home'}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={300}
            aria-label={`${game.homeTeam?.displayName || 'Home'} score`}
            className="scorekeeper-score-input"
            value={homeScore}
            disabled={readOnly}
            onChange={(e) => setHomeScore(clamp(Number(e.target.value || 0)))}
          />
          <div className="scorekeeper-tap-row">
            {([1, 2, 3, -1] as const).map((delta) => (
              <button
                key={delta}
                type="button"
                className="btn secondary scorekeeper-tap-btn"
                disabled={readOnly}
                onClick={() => bump('home', delta)}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="scorekeeper-controls">
        <label className="field">
          <span>Status note (delay / gym update)</span>
          <input
            value={statusNote}
            disabled={readOnly}
            maxLength={240}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Optional delay or overtime note"
          />
        </label>
        <div className="scorekeeper-action-row">
          <button
            type="button"
            className="btn secondary"
            disabled={readOnly}
            onClick={() => {
              setStatus('live')
              void sendUpdate({ status: 'live' })
            }}
          >
            Save Live
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={readOnly}
            onClick={() => {
              setStatus('delayed')
              void sendUpdate({ status: 'delayed' })
            }}
          >
            Mark Delayed
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={readOnly}
            onClick={() => void sendUpdate({ status: 'final' })}
          >
            Finalize Game
          </button>
        </div>
      </div>

      {queuedItem && queuedItem.state === 'pending' && (
        <p className="muted" role="status">
          Queued locally ({queuedItem.attempts > 0 ? `retry #${queuedItem.attempts}` : 'syncing…'}).
        </p>
      )}

      {queuedItem && (queuedItem.state === 'forbidden' || queuedItem.state === 'validation_error') && (
        <div className="scorekeeper-error-box" role="alert">
          <p><strong>{queuedItem.state === 'forbidden' ? 'Update rejected (403)' : 'Validation issue (422)'}:</strong> {queuedItem.errorMessage}</p>
          <button type="button" className="btn secondary small" onClick={() => onDismiss(game.id)}>Dismiss</button>
        </div>
      )}

      {queuedItem && queuedItem.state === 'conflict' && (
        <div className="scorekeeper-conflict-box" role="alert">
          <strong>Score conflict detected</strong>
          <p>
            Another device saved{' '}
            <strong>
              {queuedItem.serverGame?.awayScore ?? '—'}–{queuedItem.serverGame?.homeScore ?? '—'} ({queuedItem.serverGame?.status || 'updated'})
            </strong>{' '}
            while your device had{' '}
            <strong>
              {queuedItem.payload.awayScore ?? '—'}–{queuedItem.payload.homeScore ?? '—'} ({queuedItem.payload.status})
            </strong>.
          </p>
          <div className="row-actions">
            <button type="button" className="btn secondary small" onClick={() => void onUseServer(game.id)}>
              Use server score ({queuedItem.serverGame?.awayScore ?? '—'}–{queuedItem.serverGame?.homeScore ?? '—'})
            </button>
            <button
              type="button"
              className="btn primary small"
              disabled={!canKeepMineOnConflict}
              onClick={() => void onKeepMine(game.id, queuedItem.serverGame?.lockVersion)}
            >
              Keep my score ({queuedItem.payload.awayScore ?? '—'}–{queuedItem.payload.homeScore ?? '—'})
            </button>
          </div>
          {!canKeepMineOnConflict && (
            <small className="muted">Server game is already finalized; only tournament staff or admins can overwrite a final score.</small>
          )}
        </div>
      )}
    </article>
  )
}
