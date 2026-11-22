import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'
import { useAuthContext } from '../../contexts/AuthContext'
import { hasCapability } from '../../lib/adminModules'
import { api } from '../../lib/api'
import { formatGuamDate, formatGuamTime, toLocalDateTimeInputValue } from '../../lib/datetime'
import { gameMatchupLabel } from '../../lib/games'
import { useAsync } from '../../lib/hooks'
import {
  ACTIVE_GAME_STATUSES, OUTCOME_LABELS, draftFromGame, draftPayload, needsOfficialWinnerPicker, readResultDrafts, writeResultDrafts,
  type ResultDraft, type ResultDrafts,
} from '../../lib/resultDrafts'
import {
  dismissQueueItem, enqueueScoreMutation, flushScoreQueue, readScoreQueue, rebaseScoreConflict,
  type QueuedScoreItem, type ScoreMutationPayload,
} from '../../lib/scoreQueue'
import type { BracketAdvancement, CurrentUser, Game, GameOutcome, GameStatus, SavedResult, Tournament } from '../../lib/types'

const gameDate = (startTime: string) => toLocalDateTimeInputValue(startTime).slice(0, 10)
const nightLabel = (date: string) => {
  const time = new Date(`${date}T00:00:00+10:00`)
  return Number.isNaN(time.getTime()) ? date : formatGuamDate(time, { weekday: 'short' })
}
const scoreLine = (home: number | string | null, away: number | string | null) => `${home === '' ? '—' : home ?? '—'} – ${away === '' ? '—' : away ?? '—'}`

export function AdminScorekeeperPage() {
  const { user } = useAuthContext()
  const [params, setParams] = useSearchParams()
  const requestedTournament = params.get('tournamentId')
  const requestedDate = params.get('date')
  const [view, setView] = useState<'night' | 'missing' | 'all'>('night')
  const tournaments = useAsync(() => api.adminTournaments('scores_and_stats'), [])
  const focusedGameId = params.get('gameId')
  const needsLinkedGame = Boolean(focusedGameId && (!requestedTournament || !requestedDate))
  const deepLink = useAsync(() => needsLinkedGame && focusedGameId
    ? api.adminGame(focusedGameId) : Promise.resolve(null), [needsLinkedGame, focusedGameId])
  const linkedGame = deepLink.data?.game
  const date = requestedDate || (linkedGame ? gameDate(linkedGame.startTime) : gameDate(new Date().toISOString()))
  const rows = tournaments.data?.tournaments ?? []
  const linkedTournament = requestedTournament ?? linkedGame?.tournamentId
  const choosingLinkedGame = needsLinkedGame && deepLink.loading
  const tournament = rows.find((row) => row.id === linkedTournament) ?? (!linkedTournament && !choosingLinkedGame
    ? rows.find((row) => row.status === 'live') ?? rows.find((row) => row.status === 'upcoming') ?? rows[0]
    : undefined)
  const tournamentId = tournament?.id ?? linkedTournament

  function select(filters: { tournamentId?: string; date?: string }) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(filters).forEach(([key, value]) => next.set(key, value))
      next.delete('gameId')
      return next
    })
  }

  useEffect(() => {
    if ((!requestedTournament && tournamentId) || (!requestedDate && linkedGame)) {
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (!requestedTournament && tournamentId) next.set('tournamentId', tournamentId)
        if (!requestedDate && linkedGame) next.set('date', gameDate(linkedGame.startTime))
        return next
      }, { replace: true })
    }
  }, [requestedTournament, requestedDate, tournamentId, linkedGame, setParams])

  return (
    <>
      <PageHeader title="Enter results" />
      <Panel>
        <div className="scorekeeper-toolbar">
          <Field label="Tournament">
            <select value={tournamentId ?? ''} onChange={(event) => select({ tournamentId: event.target.value })}>
              {!tournamentId && <option value="">Choose a tournament</option>}
              {tournamentId && !tournament && <option value={tournamentId}>Selected tournament</option>}
              {rows.map((row) => <option key={row.id} value={row.id}>{row.name} · {row.year}</option>)}
            </select>
          </Field>
          <Field label="Choose another date">
            <input type="date" value={date} onChange={(event) => {
              if (event.target.value) {
                setView('night')
                select({ date: event.target.value })
              }
            }} />
          </Field>
        </div>
      </Panel>
      {(tournaments.loading || choosingLinkedGame) && (!tournamentId || choosingLinkedGame) && <LoadingState />}
      {tournaments.error && !tournamentId && <ErrorState message={tournaments.error} onRetry={tournaments.reload} />}
      {!tournaments.loading && !tournaments.error && !tournamentId && <EmptyState title="No tournaments available" />}
      {user && tournamentId && !choosingLinkedGame && (
        <ResultWorkspace key={`${user.id}:${tournamentId}`} user={user} tournament={tournament}
          tournamentId={tournamentId} date={date} focusedGameId={focusedGameId} view={view}
          onViewChange={setView} onDateChange={(next) => select({ date: next })} />
      )}
    </>
  )
}

function ResultWorkspace({ user, tournament, tournamentId, date, focusedGameId, view, onViewChange, onDateChange }: {
  user: CurrentUser
  tournament?: Tournament
  tournamentId: string
  date: string
  focusedGameId: string | null
  view: 'night' | 'missing' | 'all'
  onViewChange: (view: 'night' | 'missing' | 'all') => void
  onDateChange: (date: string) => void
}) {
  const userId = user.id
  const scope = { type: 'tournament', id: tournamentId }
  const canCorrect = user.capabilities ? hasCapability(user, 'scores_and_stats', 'correct_final', scope) : user.isStaff || user.isAdmin
  const canRequest = hasCapability(user, 'scores_and_stats', 'request_correction', scope)
  const canEdit = hasCapability(user, 'scores_and_stats', 'edit', scope) &&
    (canCorrect || !tournament || ['live', 'upcoming'].includes(tournament.status))
  const canResolveBracket = hasCapability(user, 'brackets', 'resolve_exceptions', scope)
  const draftKey = `fd_result_drafts_v1:${userId}:${tournamentId}`
  const [drafts, setDrafts] = useState(() => readResultDrafts(draftKey, tournamentId))
  const draftsRef = useRef(drafts)
  const [queue, setQueue] = useState(() => readScoreQueue(userId))
  const [overrides, setOverrides] = useState<Record<string, Game>>({})
  const [brackets, setBrackets] = useState<Record<string, BracketAdvancement>>({})
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pendingRequests, setPendingRequests] = useState<Record<string, boolean>>({})
  const [review, setReview] = useState(false)
  const reviewRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const sending = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const nights = useAsync(async () => {
    const result = await api.adminGames(tournamentId, { date: view === 'night' ? date : undefined, unscoredOnly: view === 'missing' || undefined })
    return { ...result, date, view }
  }, [tournamentId, date, view])
  const corrections = useAsync(
    () => canCorrect ? api.adminScoreCorrectionRequests(tournamentId) : Promise.resolve({ correctionRequests: [] }),
    [tournamentId, canCorrect],
  )

  const storeDrafts = useCallback((next: ResultDrafts) => {
    draftsRef.current = next
    setDrafts(next)
    if (!writeResultDrafts(draftKey, next)) setMessage('This browser could not store edits. Keep this page open until your result is published.')
  }, [draftKey])

  function discardDraft(id: string) {
    const next = { ...draftsRef.current }
    delete next[id]
    storeDrafts(next)
  }

  const applySaved = useCallback((rows: Partial<SavedResult>[]) => {
    setOverrides((current) => {
      const next = { ...current }
      rows.forEach((row) => {
        if (row.game) next[row.game.id] = row.game
      })
      return next
    })
    setBrackets((current) => {
      const next = { ...current }
      rows.forEach(({ game, bracketAdvancement }) => {
        if (!game) return
        if (bracketAdvancement?.needsReview) next[game.id] = bracketAdvancement
        else if (bracketAdvancement?.advanced) delete next[game.id]
      })
      return next
    })
  }, [])

  const runSync = useCallback(async (options: { force?: boolean; ids?: string[]; batch?: boolean } = {}) => {
    if (sending.current || !navigator.onLine) return
    const snapshot = draftsRef.current
    const currentQueue = readScoreQueue(userId)
    if (!currentQueue.some((item) => (!item.tournamentId || item.tournamentId === tournamentId) &&
      (item.state === 'pending' || (options.force && item.state === 'paused_auth')))) return
    sending.current = true
    setBusy(true)
    try {
      const result = await flushScoreQueue(userId, api.adminScoreGame, {
        force: options.force,
        gameIds: options.ids,
        tournamentId,
        sendBatch: options.batch ? (rows) => api.adminBatchResults(rows, options.ids ? tournamentId : undefined) : undefined,
      })
      const syncedIds = new Set(result.syncedGames.map((game) => game.id))
      const liveStorageDrafts = readResultDrafts(draftKey, tournamentId)
      const next = mountedRef.current ? { ...draftsRef.current } : { ...liveStorageDrafts }
      let changedDrafts = false
      result.syncedGames.forEach((game) => {
        if (!syncedIds.has(game.id)) return
        if (result.remaining.some((item) => item.gameId === game.id)) return
        const currentEntry = next[game.id]
        const submittedEntry = snapshot[game.id]
        if (currentEntry && submittedEntry && (currentEntry === submittedEntry || JSON.stringify(currentEntry) === JSON.stringify(submittedEntry))) {
          delete next[game.id]
          changedDrafts = true
        }
      })
      if (mountedRef.current) {
        if (changedDrafts) storeDrafts(next)
      } else if (changedDrafts) {
        writeResultDrafts(draftKey, next)
        return
      } else {
        return
      }
      setQueue(result.remaining)
      applySaved(result.savedResults)
      if (result.pausedForAuth) setMessage('Sign in again to sync results saved on this device.')
      else if (result.syncedGames.length) {
        const count = result.syncedGames.length
        const failed = options.ids?.filter((id) => result.remaining.some((item) => item.gameId === id)).length ?? 0
        setMessage(`${count} ${count === 1 ? 'result' : 'results'} published.${failed ? ` ${failed} still to sync or review.` : ''}${result.standingsFailed ? ' Standings refresh failed. Ask staff to recompute standings.' : ''}`)
        void nights.reload()
      } else if (options.ids?.length) {
        const waiting = result.remaining.some((item) => options.ids?.includes(item.gameId) && item.state === 'pending')
        setMessage(waiting ? 'Results saved on this device · waiting to sync.' : 'Review the highlighted result errors before retrying.')
      }
    } finally {
      sending.current = false
      setBusy(false)
    }
  }, [userId, tournamentId, nights.reload, applySaved, storeDrafts])

  useEffect(() => {
    const reconnect = () => {
      setOnline(true)
      void runSync({ force: true, batch: true })
      void nights.reload()
    }
    const disconnect = () => setOnline(false)
    window.addEventListener('online', reconnect)
    window.addEventListener('offline', disconnect)
    return () => {
      window.removeEventListener('online', reconnect)
      window.removeEventListener('offline', disconnect)
    }
  }, [runSync, nights.reload])

  useEffect(() => {
    if (navigator.onLine) void runSync({ force: true, batch: true })
    // At session entry, resume queued submissions left by a prior sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    if (!online || !queue.some((item) => item.state === 'pending' && (!item.tournamentId || item.tournamentId === tournamentId))) return
    const timer = window.setInterval(() => void runSync({ batch: true }), 5_000)
    return () => window.clearInterval(timer)
  }, [online, queue, runSync, tournamentId])

  const data = nights.data?.date === date && nights.data.view === view ? nights.data : undefined
  const gamesById = new Map<string, Game>()
  for (const game of data?.games ?? []) gamesById.set(game.id, game)
  // Preserve drafts and sync errors in context when a filter or a disconnected reload hides their game.
  for (const draft of Object.values(drafts)) {
    if (gameDate(draft.game.startTime) === date || view !== 'night' || draft.game.id === focusedGameId) {
      if (!gamesById.has(draft.game.id)) gamesById.set(draft.game.id, draft.game)
    }
  }
  const games = [...gamesById.values()].map((game) => {
    const override = overrides[game.id]
    return (override?.lockVersion ?? -1) >= (game.lockVersion ?? 0) ? override : game
  }).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const resolvedGamesById = new Map(games.map((game) => [game.id, game]))
  const queued = new Map(queue.map((item) => [item.gameId, item]))
  const waiting = (id: string) => ['pending', 'paused_auth'].includes(queued.get(id)?.state ?? '')
  const batchDrafts = Object.values(drafts).filter(({ game }) => {
    const latest = resolvedGamesById.get(game.id) ?? game
    return !latest.placeholder && !waiting(game.id) &&
      queued.get(game.id)?.state !== 'conflict' && (latest.status === 'final' ? canCorrect : canEdit)
  })
  const quickDates = (data?.availableDates ?? []).filter((day) => day !== date)
  const nextIndex = quickDates.findIndex((day) => day > date)
  const quickStart = Math.max(0, (nextIndex < 0 ? quickDates.length - 4 : nextIndex) - 2)
  const visibleDates = quickDates.slice(quickStart, quickStart + 6)

  useEffect(() => {
    if (focusedGameId && data) {
      const target = document.getElementById(`result-game-${focusedGameId}`)
      target?.scrollIntoView?.({ block: 'nearest' })
      target?.focus({ preventScroll: true })
    }
  }, [data, focusedGameId])

  function updateDraft(draft: ResultDraft) {
    setErrors((current) => ({ ...current, [draft.game.id]: '' }))
    storeDrafts({ ...draftsRef.current, [draft.game.id]: draft })
  }

  function saveResults(entries: ResultDraft[], batch = false) {
    if (sending.current) return
    const accepted: string[] = []
    const invalid: Record<string, string> = {}
    for (const draft of entries) {
      const result = draftPayload(draft, draft.game.status === 'final')
      if (result.error || !result.payload) {
        invalid[draft.game.id] = result.error || 'Review this result.'
      } else {
        const items = enqueueScoreMutation(userId, draft.game.id, result.payload, { tournamentId })
        const stored = readScoreQueue(userId).find((item) => item.gameId === draft.game.id)
        if (stored?.clientMutationId && items.find((item) => item.gameId === draft.game.id)?.clientMutationId === stored.clientMutationId) {
          accepted.push(draft.game.id)
        } else {
          invalid[draft.game.id] = 'This browser could not queue the result. Enable local storage and try again.'
        }
      }
    }
    setQueue(readScoreQueue(userId))
    setErrors((current) => ({ ...current, ...Object.fromEntries(accepted.map((id) => [id, ''])), ...invalid }))
    if (!Object.keys(invalid).length) setReview(false)
    if (accepted.length) {
      if (!navigator.onLine) setMessage('Results saved on this device · waiting to sync.')
      else void runSync({ ids: accepted, batch, force: true })
    }
  }

  async function requestCorrection(gameId: string, payload: ScoreMutationPayload) {
    const submittedDraft = draftsRef.current[gameId]
    const submittedMutationId = readScoreQueue(userId).find((entry) => entry.gameId === gameId)?.clientMutationId
    try {
      await api.adminRequestScoreCorrection(gameId, payload)
      if (!mountedRef.current) return
      if (submittedDraft && draftsRef.current[gameId] === submittedDraft) discardDraft(gameId)
      const latestQueueEntry = readScoreQueue(userId).find((entry) => entry.gameId === gameId)
      if (latestQueueEntry && (!submittedMutationId || latestQueueEntry.clientMutationId === submittedMutationId)) {
        setQueue(dismissQueueItem(userId, gameId))
      }
      setPendingRequests((current) => ({ ...current, [gameId]: true }))
      setMessage('Correction request sent to tournament staff.')
      void corrections.reload()
    } catch (error) {
      if (!mountedRef.current) return
      setErrors((current) => ({ ...current, [gameId]: error instanceof Error ? error.message : 'Could not send correction request.' }))
    }
  }

  const allPending = corrections.data?.correctionRequests ?? []

  return (
    <>
      <div className="scorekeeper-toolbar scorekeeper-night">
        <h2>{view === 'night' ? `${nightLabel(date)} · Guam` : view === 'missing' ? 'Missing results' : 'All dates'}</h2>
        <div className="scorekeeper-filter-pills" role="group" aria-label="Show games">
          {([['night', 'Selected date'], ['missing', 'Missing results'], ['all', 'All dates']] as const).map(([value, label]) =>
            <button type="button" key={value} className={view === value ? 'btn primary small' : 'btn secondary small'}
              aria-pressed={view === value} onClick={() => onViewChange(value)}>{label}</button>)}
        </div>
      </div>
      {visibleDates.length > 0 && <nav aria-label="Scheduled dates" className="scorekeeper-filter-pills">
        {visibleDates.map((day) => <button type="button" key={day} className="btn secondary small" onClick={() => {
          onViewChange('night')
          onDateChange(day)
        }}>{nightLabel(day)}</button>)}
      </nav>}

      {canCorrect && (
        <Panel className="scorekeeper-card">
          <h2>Pending correction requests{allPending.length > 0 && ` (${allPending.length})`}</h2>
          {corrections.loading && <p>Loading requests…</p>}
          {corrections.error && <ErrorState message={corrections.error} onRetry={corrections.reload} />}
          {!corrections.loading && !corrections.error && !allPending.length && <p>No requests awaiting review.</p>}
          {allPending.map((request) => <CorrectionReview key={request.id} request={request} onResolved={(result) => {
            applySaved([result])
            setMessage(result.standingsStatus === 'failed' ? 'Correction approved. Standings refresh failed.' : `Correction request ${result.correctionRequest.status}.`)
            void corrections.reload()
            void nights.reload()
          }} />)}
        </Panel>
      )}

      <div className="scorekeeper-status-bar" role="status">
        {message && <p>{message}</p>}
        {!online && <p>Offline · drafts stay on this device.</p>}
        {queue.some((item) => item.state === 'paused_auth') && online &&
          <button className="btn secondary small" type="button" disabled={busy} onClick={() => void runSync({ force: true, batch: true })}>Retry sync after signing in</button>}
      </div>

      {nights.loading && !games.length && <LoadingState />}
      {nights.error && <ErrorState message={nights.error} onRetry={nights.reload} />}
      {data && !nights.loading && !nights.error && !games.length && (
        <Panel>
          <EmptyState title={view === 'missing' ? 'No missing results' : view === 'all' ? 'No games scheduled' : 'No games on this Guam date'} />
          {view === 'night' && data.nextScheduledDate && <button type="button" className="btn secondary" onClick={() => onDateChange(data.nextScheduledDate!)}>
            Next scheduled night · {nightLabel(data.nextScheduledDate)}
          </button>}
        </Panel>
      )}

      <div className="scorekeeper-card-list">
        {games.map((game) => <ResultCard key={game.id} game={game} draft={drafts[game.id]} item={queued.get(game.id)}
          canEdit={canEdit} canCorrect={canCorrect} canRequest={canRequest} canResolveBracket={canResolveBracket}
          busy={busy} error={errors[game.id]} requestSent={pendingRequests[game.id]} bracket={brackets[game.id]}
          onChange={updateDraft} onSave={(draft) => saveResults([draft])}
          onRequest={(payload) => requestCorrection(game.id, payload)}
          onUseServer={() => {
            const server = queued.get(game.id)?.serverGame
            if (server) applySaved([{ game: server }])
            setQueue(dismissQueueItem(userId, game.id))
            discardDraft(game.id)
          }}
          onRebase={(reason) => {
            setQueue(rebaseScoreConflict(userId, game.id, { reason }))
            void runSync({ ids: [game.id], force: true })
          }}
          onResolveBracket={(resolvedId) => {
            setBrackets((current) => Object.fromEntries(Object.entries(current).filter(([, bracket]) => bracket.nextGameId !== resolvedId)))
            void nights.reload()
          }} />)}
      </div>

      {review && batchDrafts.length > 0 && (
        <section className="panel scorekeeper-card" ref={reviewRef} tabIndex={-1} aria-labelledby="review-results-heading">
          <h2 id="review-results-heading">Review results</h2>
          <ul className="scorekeeper-review-list">
            {batchDrafts.map((draft) => {
              const stopped = draft.status === 'postponed' || draft.status === 'cancelled'
              return <li key={draft.game.id}>
                <strong>{gameMatchupLabel(draft.game)}</strong>
                <span>{nightLabel(gameDate(draft.game.startTime))} · {stopped ? OUTCOME_LABELS[draft.outcome]
                  : `Home ${scoreLine(draft.homeScore, draft.awayScore)} Away · ${OUTCOME_LABELS[draft.outcome]} · ${draft.status}`}</span>
                {draft.winner && !stopped && <small>Winner · {draft.winner === draft.game.homeTeamId ? draft.game.homeTeam?.displayName : draft.game.awayTeam?.displayName}</small>}
                {errors[draft.game.id] && <p className="form-error">{errors[draft.game.id]}</p>}
              </li>
            })}
          </ul>
          <div className="row-actions">
            <button type="button" className="btn secondary" onClick={() => setReview(false)}>Back to results</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => saveResults(batchDrafts, true)}>Confirm and save results</button>
          </div>
        </section>
      )}
      {!review && batchDrafts.length > 0 && (
        <div className="scorekeeper-save-bar">
          <button type="button" className="btn primary" disabled={busy} onClick={() => {
            setReview(true)
            requestAnimationFrame(() => reviewRef.current?.focus())
          }}>Review &amp; save {batchDrafts.length} {batchDrafts.length === 1 ? 'result' : 'results'}</button>
        </div>
      )}
    </>
  )
}

function ResultCard({ game, draft, item, canEdit, canCorrect, canRequest, canResolveBracket, busy, error, requestSent, bracket,
  onChange, onSave, onRequest, onUseServer, onRebase, onResolveBracket }: {
  game: Game
  draft?: ResultDraft
  item?: QueuedScoreItem
  canEdit: boolean
  canCorrect: boolean
  canRequest: boolean
  canResolveBracket: boolean
  busy: boolean
  error?: string
  requestSent?: boolean
  bracket?: BracketAdvancement
  onChange: (draft: ResultDraft) => void
  onSave: (draft: ResultDraft) => void
  onRequest: (payload: ScoreMutationPayload) => Promise<void>
  onUseServer: () => void
  onRebase: (reason: string) => void
  onResolveBracket: (gameId: string) => void
}) {
  const currentGame = item?.serverGame ?? game
  const isFinal = currentGame.status === 'final'
  const [editorOpen, setEditorOpen] = useState(Boolean(draft && isFinal))
  const [requesting, setRequesting] = useState(false)
  const [conflictReason, setConflictReason] = useState<string | null>(null)
  const [requestError, setRequestError] = useState('')
  const [resolving, setResolving] = useState(false)
  const [bracketError, setBracketError] = useState('')
  const conflict = item?.state === 'conflict' && item.serverGame
  const waiting = item?.state === 'pending' || item?.state === 'paused_auth'
  const canPropose = isFinal && !canCorrect && canRequest
  const draftValue = draft ?? draftFromGame(currentGame)
  const hasError = Boolean(error || item && !waiting)
  const chip = hasError || game.bracketNeedsReview || bracket?.needsReview ? 'Needs review' :
    waiting ? 'Saved on this device · waiting to sync' : draft ? 'Unsaved draft' :
      game.scoreUpdatedAt || !ACTIVE_GAME_STATUSES.includes(game.status) ? 'Saved and published' : null
  const editing = (!isFinal && canEdit) || (editorOpen && (canCorrect || canPropose))
  const stopped = draftValue.outcome === 'postponed' || draftValue.outcome === 'cancelled'
  const parseDraftInt = (value: string) => value.trim() !== '' && /^\d+$/.test(value.trim()) ? Number(value) : null
  const showWinnerPicker = !stopped && needsOfficialWinnerPicker(game, draftValue.outcome, parseDraftInt(draftValue.homeScore), parseDraftInt(draftValue.awayScore))
  const targetId = bracket?.nextGameId ?? game.id
  const nextGame = bracket?.affectedNextGame

  function change(values: Partial<ResultDraft>) {
    setRequestError('')
    onChange({ ...draftValue, ...values })
  }

  function changeOutcome(outcome: GameOutcome) {
    const status = outcome === 'postponed' || outcome === 'cancelled' ? outcome :
      outcome === 'forfeit' || outcome === 'overtime' || outcome === 'shootout' || stopped ? 'final' : draftValue.status
    change({ status, outcome, winner: '', start: '' })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canPropose) {
      onSave(draftValue)
      return
    }

    if (!draftValue.reason.trim()) {
      setRequestError('Enter a reason for the correction request.')
      return
    }
    const result = draftPayload(draftValue, false)
    if (result.error || !result.payload) {
      setRequestError(result.error || 'Review the proposed result.')
      return
    }
    setRequestError('')
    setRequesting(true)
    try {
      await onRequest(result.payload)
    } finally {
      setRequesting(false)
    }
  }

  async function resolveBracket() {
    setResolving(true)
    setBracketError('')
    try {
      await api.adminResolveBracketReview(targetId)
      onResolveBracket(targetId)
    } catch (err) {
      setBracketError(err instanceof Error ? err.message : 'Could not resolve the bracket review.')
    } finally {
      setResolving(false)
    }
  }

  return (
    <article className="panel scorekeeper-card" id={`result-game-${game.id}`} tabIndex={-1} aria-label={gameMatchupLabel(game)}>
      <div className="scorekeeper-card-head">
        <div>
          <strong>{formatGuamTime(game.startTime)}{game.gameNumber ? ` · Game #${game.gameNumber}` : ''}</strong>
          <small>{nightLabel(gameDate(game.startTime))}</small>
        </div>
        <div className="scorekeeper-status-indicators">
          {game.division && <span className="scorekeeper-chip">{game.division}</span>}
          <StatusBadge status={currentGame.status} />
        </div>
      </div>
      {chip && <p className="scorekeeper-chip scorekeeper-save-state">{chip}</p>}

      {game.placeholder && <p className="form-note">Placeholder matchup — assign teams in Schedule before entering a result.</p>}
      {(game.bracketNeedsReview || bracket?.needsReview) && (
        <div className="scorekeeper-conflict-box">
          <strong>Bracket needs review{nextGame ? ` · ${gameMatchupLabel(nextGame)}` : ''}</strong>
          <p>{nextGame?.bracketExceptionNote || game.bracketExceptionNote || (nextGame ? 'Review the downstream matchup before resolving this flag.' : 'Confirm this matchup with tournament staff.')}</p>
          {bracketError && <p role="alert">{bracketError}</p>}
          {canResolveBracket && <div><button className="btn secondary small" type="button" disabled={resolving} onClick={() => void resolveBracket()}>Mark bracket review resolved</button></div>}
        </div>
      )}

      {conflict && (
        <div className="scorekeeper-conflict-box" role="alert">
          <div className="scorekeeper-scoreboard">
            <div><strong>Server saved score</strong><p>{scoreLine(conflict.homeScore, conflict.awayScore)} · {conflict.status}</p></div>
            <div><strong>Your proposed score</strong><p>{scoreLine(item.payload.homeScore, item.payload.awayScore)} · {item.payload.status}</p></div>
          </div>
          {isFinal && canCorrect && <Field label="Correction reason">
            <input maxLength={500} value={conflictReason ?? draft?.reason ?? ''} onChange={(event) => setConflictReason(event.target.value)} />
          </Field>}
          <div className="row-actions">
            <button type="button" className="btn secondary" disabled={busy} onClick={onUseServer}>Use server score</button>
            {(isFinal ? canCorrect : canEdit) && <button type="button" className="btn primary"
              disabled={busy || (isFinal && (conflictReason ?? draft?.reason ?? '').trim().length < 3)}
              onClick={() => onRebase(conflictReason ?? draft?.reason ?? '')}>Submit correction against latest version</button>}
          </div>
        </div>
      )}
      {requestSent && <p className="form-note">Correction requested</p>}
      {isFinal && !game.placeholder && (canCorrect || canPropose) && (!conflict || canPropose) &&
        <div><button type="button" className="btn secondary small" aria-expanded={editorOpen} disabled={waiting || busy}
          onClick={() => setEditorOpen(!editorOpen)}>
          {canCorrect ? 'Correct final score' : 'Request correction'}
        </button></div>}

      <form className="scorekeeper-controls" onSubmit={submit}>
        <fieldset disabled={!editing || waiting || game.placeholder || busy || requesting || Boolean(conflict && !canPropose)} className="scorekeeper-fields">
          <legend className="sr-only">Game result</legend>
          <div className="scorekeeper-scoreboard">
            <label className="scorekeeper-team-col">
              <span className="scorekeeper-team-label">Home · {game.homeTeam?.displayName || 'Home team'}</span>
              <input className="scorekeeper-score-input" inputMode="numeric" maxLength={3} aria-label={`Home score · ${game.homeTeam?.displayName || 'Home team'}`}
                value={editing ? (stopped ? '' : draftValue.homeScore) : currentGame.homeScore ?? ''}
                disabled={stopped} onChange={(event) => change({ homeScore: event.target.value })} />
            </label>
            <label className="scorekeeper-team-col">
              <span className="scorekeeper-team-label">Away · {game.awayTeam?.displayName || 'Away team'}</span>
              <input className="scorekeeper-score-input" inputMode="numeric" maxLength={3} aria-label={`Away score · ${game.awayTeam?.displayName || 'Away team'}`}
                value={editing ? (stopped ? '' : draftValue.awayScore) : currentGame.awayScore ?? ''}
                disabled={stopped} onChange={(event) => change({ awayScore: event.target.value })} />
            </label>
          </div>
          {editing && !game.placeholder && (
            <>
              <div className="scorekeeper-toolbar">
                <label className="scorekeeper-toggle">
                  <input type="checkbox" checked={draftValue.status === 'final'} disabled={stopped || draftValue.outcome === 'forfeit'}
                    onChange={(event) => change({
                      status: event.target.checked ? 'final' : ACTIVE_GAME_STATUSES.includes(currentGame.status) ? currentGame.status : 'scheduled',
                    })} />
                  Final
                </label>
                {!stopped && draftValue.status !== 'final' && <Field label="Game status">
                  <select value={draftValue.status} onChange={(event) => change({ status: event.target.value as GameStatus })}>
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </Field>}
                <Field label="Game outcome">
                  <select value={draftValue.outcome} onChange={(event) => changeOutcome(event.target.value as GameOutcome)}>
                    {Object.entries(OUTCOME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              {showWinnerPicker && (
                <Field label="Official winner">
                  <select value={draftValue.winner} onChange={(event) => change({ winner: event.target.value })}>
                    <option value="">Select winner</option>
                    <option value={game.homeTeamId}>{game.homeTeam?.displayName || 'Home team'}</option>
                    <option value={game.awayTeamId}>{game.awayTeam?.displayName || 'Away team'}</option>
                  </select>
                </Field>
              )}
              <Field label="Public note"><input maxLength={240} value={draftValue.note} onChange={(event) => change({ note: event.target.value })} /></Field>
              {draftValue.outcome === 'postponed' && !canPropose && <Field label="Rescheduled time (Guam)">
                <input type="datetime-local" value={draftValue.start} onChange={(event) => change({ start: event.target.value })} />
              </Field>}
              {isFinal && <Field label="Reason"><textarea maxLength={500} value={draftValue.reason} onChange={(event) => change({ reason: event.target.value })} /></Field>}
              <div className="row-actions">
                <button type="submit" className="btn primary" disabled={!draft}>{canPropose ? 'Send correction request' : 'Save result'}</button>
              </div>
            </>
          )}
        </fieldset>
      </form>
      {!editing && currentGame.resultOutcome && <p className="form-note">{OUTCOME_LABELS[currentGame.resultOutcome]}{currentGame.statusNote ? ` · ${currentGame.statusNote}` : ''}</p>}
      {(error || requestError || item?.errorMessage) && !conflict && <p role="alert" className="form-error">{error || requestError || item?.errorMessage}</p>}
      {(error || requestError) && conflict && <p role="alert" className="form-error">{error || requestError}</p>}
    </article>
  )
}

type CorrectionResponse = Awaited<ReturnType<typeof api.adminResolveScoreCorrection>>
function CorrectionReview({ request, onResolved }: {
  request: CorrectionResponse['correctionRequest']
  onResolved: (result: CorrectionResponse) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const { game } = request
  const winner = [game.homeTeam, game.awayTeam].find((team) => team?.id === request.proposedOfficialWinnerTeamId)

  async function resolve(action: 'approve' | 'reject') {
    setBusy(true)
    setError('')
    try {
      onResolved(await api.adminResolveScoreCorrection(request.id, action, note.trim() || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the correction request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="scorekeeper-request">
      <summary><strong>{gameMatchupLabel(game)}</strong> · {request.requestedBy}</summary>
      <div className="scorekeeper-scoreboard">
        <div><strong>Saved result</strong><p>{scoreLine(game.homeScore, game.awayScore)} · {game.status}</p></div>
        <div><strong>Proposed result</strong><p>{scoreLine(request.proposedHomeScore, request.proposedAwayScore)} · {request.proposedStatus}
          {request.proposedResultOutcome ? ` · ${OUTCOME_LABELS[request.proposedResultOutcome]}` : ''}</p></div>
      </div>
      {winner && <p>Official winner · {winner.displayName}</p>}
      {request.proposedStatusNote && <p>Public note · {request.proposedStatusNote}</p>}
      <p>{request.reason}</p>
      <Field label="Resolution note"><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      <div className="row-actions">
        <button type="button" className="btn primary small" disabled={busy} onClick={() => void resolve('approve')}>Approve</button>
        <button type="button" className="btn secondary small" disabled={busy} onClick={() => void resolve('reject')}>Reject</button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
    </details>
  )
}
