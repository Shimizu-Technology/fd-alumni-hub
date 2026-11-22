import { ApiError } from './api'
import type { BatchResultRow, Game, GameOutcome, GameStatus, SavedResult } from './types'

export const SCORE_QUEUE_STORAGE_PREFIX = 'fd_score_queue_v1:'
export const SCORE_QUEUE_BACKOFF_MS = [5_000, 15_000, 30_000] as const

export type ScoreMutationPayload = {
  homeScore: number | null
  awayScore: number | null
  status: GameStatus
  statusNote: string | null
  lockVersion?: number
  resultOutcome?: GameOutcome | null
  officialWinnerTeamId?: string | null
  startTime?: string
  reason?: string
}

export type ScoreQueueItemState =
  | 'pending'
  | 'paused_auth'
  | 'conflict'
  | 'validation_error'
  | 'forbidden'

export type QueuedScoreItem = {
  gameId: string
  tournamentId?: string
  clientMutationId: string
  payload: ScoreMutationPayload
  queuedAt: string
  attempts: number
  nextRetryAt: number
  state: ScoreQueueItemState
  errorMessage?: string
  serverGame?: Game | null
}

export type ScoreSendFn = (
  gameId: string,
  body: ScoreMutationPayload & { clientMutationId: string },
) => Promise<SavedResult>

type BatchSendFn = (
  results: (ScoreMutationPayload & { gameId: string; clientMutationId: string })[],
) => Promise<{ results: BatchResultRow[]; standingsStatus?: SavedResult['standingsStatus'] }>

export type FlushScoreQueueResult = {
  syncedGames: Game[]
  savedResults: SavedResult[]
  standingsFailed: boolean
  remaining: QueuedScoreItem[]
  pausedForAuth: boolean
  hasNewerPending: boolean
}

export function scoreQueueStorageKey(userId: string) {
  return `${SCORE_QUEUE_STORAGE_PREFIX}${userId}`
}

export function createMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const rand = Math.random().toString(36).slice(2, 12)
  return `mut_${Date.now().toString(36)}_${rand}`
}

function normalizedScoreKey(payload: ScoreMutationPayload) {
  return JSON.stringify({
    awayScore: payload.awayScore ?? null,
    resultOutcome: payload.resultOutcome,
    officialWinnerTeamId: payload.officialWinnerTeamId,
    startTime: payload.startTime,
    reason: payload.reason?.trim() || undefined,
    lockVersion: payload.lockVersion,
    homeScore: payload.homeScore ?? null,
    status: payload.status,
    statusNote: payload.statusNote?.trim() || null,
  })
}

export function readScoreQueue(userId: string, storage: Storage | null = defaultStorage()): QueuedScoreItem[] {
  if (!userId || !storage) return []
  try {
    const raw = storage.getItem(scoreQueueStorageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidQueueItem).map((item) => {
      // Queues saved before final correction guardrails may carry a force flag.
      const { forceOverwrite: _legacyForce, ...payload } = item.payload as ScoreMutationPayload & { forceOverwrite?: boolean }
      return { ...item, payload }
    })
  } catch {
    return []
  }
}

export function writeScoreQueue(
  userId: string,
  items: QueuedScoreItem[],
  storage: Storage | null = defaultStorage(),
): QueuedScoreItem[] {
  if (!userId || !storage) return items
  try {
    if (items.length === 0) {
      storage.removeItem(scoreQueueStorageKey(userId))
    } else {
      storage.setItem(scoreQueueStorageKey(userId), JSON.stringify(items))
    }
  } catch {
    // Ignore storage quota / private mode errors; caller keeps in-memory state.
  }
  return items
}

export function enqueueScoreMutation(
  userId: string,
  gameId: string,
  payload: ScoreMutationPayload,
  {
    tournamentId,
    storage = defaultStorage(),
    idGenerator = createMutationId,
    now = Date.now(),
  }: {
    tournamentId?: string
    storage?: Storage | null
    idGenerator?: () => string
    now?: number
  } = {},
): QueuedScoreItem[] {
  const current = readScoreQueue(userId, storage)
  const existing = current.find((item) => item.gameId === gameId)

  const normalizedPayload: ScoreMutationPayload = {
    homeScore: payload.homeScore,
    awayScore: payload.awayScore,
    status: payload.status,
    statusNote: payload.statusNote?.trim() || null,
    lockVersion: payload.lockVersion,
    resultOutcome: payload.resultOutcome,
    officialWinnerTeamId: payload.officialWinnerTeamId,
    startTime: payload.startTime,
    reason: payload.reason?.trim() || undefined,
  }

  // Always mint a fresh clientMutationId whenever the payload changes so a subsequent
  // edit after a dropped response is never swallowed as an idempotent replay (H4).
  const payloadUnchanged =
    existing &&
    normalizedScoreKey(existing.payload) === normalizedScoreKey(normalizedPayload)

  const nextItem: QueuedScoreItem = {
    gameId,
    tournamentId: tournamentId ?? existing?.tournamentId,
    clientMutationId: payloadUnchanged ? existing.clientMutationId : idGenerator(),
    payload: normalizedPayload,
    queuedAt: new Date(now).toISOString(),
    attempts: 0,
    nextRetryAt: 0,
    state: 'pending',
  }

  const updated = [
    ...current.filter((item) => item.gameId !== gameId),
    nextItem,
  ]
  return writeScoreQueue(userId, updated, storage)
}

export function resolveConflictUseServer(
  userId: string,
  gameId: string,
  storage: Storage | null = defaultStorage(),
): QueuedScoreItem[] {
  const updated = readScoreQueue(userId, storage).filter((item) => item.gameId !== gameId)
  return writeScoreQueue(userId, updated, storage)
}

export function rebaseScoreConflict(
  userId: string,
  gameId: string,
  {
    reason,
    storage = defaultStorage(),
    idGenerator = createMutationId,
    now = Date.now(),
  }: {
    reason?: string
    storage?: Storage | null
    idGenerator?: () => string
    now?: number
  } = {},
): QueuedScoreItem[] {
  const current = readScoreQueue(userId, storage)
  const updated = current.map((item) => {
    const version = item.serverGame?.lockVersion
    const correctionReason = reason?.trim() || item.payload.reason
    if (item.gameId !== gameId || item.state !== 'conflict' || version === undefined) return item
    if (item.serverGame?.status === 'final' && (!correctionReason || correctionReason.length < 3 || correctionReason.length > 500)) return item
    return {
      ...item,
      clientMutationId: idGenerator(),
      payload: { ...item.payload, lockVersion: version, reason: correctionReason },
      queuedAt: new Date(now).toISOString(),
      attempts: 0,
      nextRetryAt: 0,
      state: 'pending' as const,
      errorMessage: undefined,
      serverGame: undefined,
    }
  })
  return writeScoreQueue(userId, updated, storage)
}

export function dismissQueueItem(
  userId: string,
  gameId: string,
  storage: Storage | null = defaultStorage(),
): QueuedScoreItem[] {
  const updated = readScoreQueue(userId, storage).filter((item) => item.gameId !== gameId)
  return writeScoreQueue(userId, updated, storage)
}

export async function flushScoreQueue(
  userId: string,
  sendFn: ScoreSendFn,
  {
    storage = defaultStorage(),
    now = Date.now(),
    force = false,
    gameIds,
    tournamentId,
    sendBatch,
  }: {
    storage?: Storage | null
    now?: number
    force?: boolean
    gameIds?: string[]
    tournamentId?: string
    sendBatch?: BatchSendFn
  } = {},
): Promise<FlushScoreQueueResult> {
  const candidates = readScoreQueue(userId, storage).filter((item) => {
    const eligible = item.state === 'pending' || (force && item.state === 'paused_auth')
    if (!eligible || (gameIds && !gameIds.includes(item.gameId))) return false
    if (tournamentId && item.tournamentId && item.tournamentId !== tournamentId) return false
    return force || item.nextRetryAt <= now
  }).slice(0, 500)

  const savedResults: SavedResult[] = []
  let standingsFailed = false
  let pausedForAuth = false
  let hasNewerPending = false

  let batchRows: Map<string, BatchResultRow> | undefined
  let batchError: unknown
  if (sendBatch && candidates.length) {
    try {
      const batch = await sendBatch(candidates.map(({ gameId, clientMutationId, payload }) => ({ ...payload, gameId, clientMutationId })))
      batchRows = new Map(batch.results.map((row) => [row.gameId, row]))
      standingsFailed = batch.standingsStatus === 'failed'
    } catch (error) {
      batchError = error
    }
  }

  for (const item of candidates) {
    if (pausedForAuth) break

    // In single-request mode, re-check latest storage right before sending in case item was dismissed or superseded.
    // In batch mode the request was already sent, so still process its result and rebase any newer edit's lockVersion.
    if (!batchRows && !batchError) {
      const latestBeforeSend = readScoreQueue(userId, storage).find((entry) => entry.gameId === item.gameId)
      if (!latestBeforeSend || latestBeforeSend.clientMutationId !== item.clientMutationId) {
        if (latestBeforeSend?.state === 'pending') hasNewerPending = true
        continue
      }
    }

    try {
      if (batchError) throw batchError
      const response = batchRows
        ? savedBatchRow(batchRows.get(item.gameId))
        : await sendFn(item.gameId, { ...item.payload, clientMutationId: item.clientMutationId })
      savedResults.push(response)
      standingsFailed ||= response.standingsStatus === 'failed'

      // Re-read storage after await: only remove if clientMutationId still matches.
      // If a newer tap replaced this item while in flight, keep it and rebase its lockVersion (B1 + H1).
      const liveQueue = readScoreQueue(userId, storage)
      const nextQueue: QueuedScoreItem[] = []
      for (const entry of liveQueue) {
        if (entry.gameId !== item.gameId) {
          nextQueue.push(entry)
          continue
        }
        if (entry.clientMutationId === item.clientMutationId) {
          // Exact mutation we just synced: remove from queue.
          continue
        }
        // Newer tap arrived during in-flight send: preserve it and rebase its base lockVersion!
        hasNewerPending = true
        const rebasedLockVersion =
          !response.idempotentReplay && response.game.lockVersion !== undefined &&
          (entry.payload.lockVersion === undefined || entry.payload.lockVersion === item.payload.lockVersion)
            ? response.game.lockVersion
            : entry.payload.lockVersion
        nextQueue.push({
          ...entry,
          payload: {
            ...entry.payload,
            lockVersion: rebasedLockVersion,
          },
        })
      }
      writeScoreQueue(userId, nextQueue, storage)
    } catch (err) {
      const liveQueue = readScoreQueue(userId, storage)

      if (err instanceof ApiError && err.status === 401) {
        pausedForAuth = true
        // Pause ALL pending items on 401 so auto-retry stops completely until re-authenticated (M2).
        const nextQueue = liveQueue.map((entry) => {
          if (entry.state === 'pending' || (entry.gameId === item.gameId && entry.clientMutationId === item.clientMutationId)) {
            return {
              ...entry,
              state: 'paused_auth' as const,
              errorMessage: 'Session expired — sign in again to sync pending scores.',
            }
          }
          return entry
        })
        writeScoreQueue(userId, nextQueue, storage)
        break
      }

      // Only mutate the entry if it still matches (gameId, clientMutationId).
      // If a newer tap superseded it during the failed request, preserve the newer tap untouched (B1).
      let supersededByNewer = false
      const nextQueue = liveQueue.map((entry) => {
        if (entry.gameId !== item.gameId) return entry
        if (entry.clientMutationId !== item.clientMutationId) {
          supersededByNewer = true
          return entry
        }

        if (err instanceof ApiError) {
          if (err.status === 403) {
            return {
              ...entry,
              state: 'forbidden' as const,
              errorMessage: err.message || 'You do not have permission to update this game score.',
            }
          }

          if (err.status === 422 || err.status === 404) {
            return {
              ...entry,
              state: 'validation_error' as const,
              errorMessage: err.message || 'Invalid score payload. Check the score and status values.',
            }
          }

          if (err.status === 409) {
            const payload = err.payload as { currentGame?: Game } | null
            return {
              ...entry,
              state: 'conflict' as const,
              errorMessage: err.message || 'Score was updated by another user.',
              serverGame: payload?.currentGame ?? null,
            }
          }
        }

        const backoffIndex = Math.min(entry.attempts, SCORE_QUEUE_BACKOFF_MS.length - 1)
        const delayMs = SCORE_QUEUE_BACKOFF_MS[backoffIndex]
        return {
          ...entry,
          state: 'pending' as const,
          attempts: entry.attempts + 1,
          nextRetryAt: now + delayMs,
          errorMessage: err instanceof Error ? err.message : 'Network unavailable — will retry automatically.',
        }
      })

      if (supersededByNewer) hasNewerPending = true
      writeScoreQueue(userId, nextQueue, storage)
    }
  }

  const remaining = readScoreQueue(userId, storage)
  return { syncedGames: savedResults.map((item) => item.game), savedResults, standingsFailed, remaining, pausedForAuth, hasNewerPending }
}

function savedBatchRow(row: BatchResultRow | undefined): SavedResult {
  if (row?.ok && row.game) return { ...row, game: row.game }
  if (row && !row.ok) throw new ApiError(row.error || row.errors?.join(' ') || 'Unable to save result.', row.status, row)
  throw new Error('No confirmation received for this result.')
}

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isValidQueueItem(item: unknown): item is QueuedScoreItem {
  if (!item || typeof item !== 'object') return false
  const candidate = item as Partial<QueuedScoreItem>
  const payload = candidate.payload
  return (
    typeof candidate.gameId === 'string' &&
    (candidate.tournamentId === undefined || typeof candidate.tournamentId === 'string') &&
    typeof candidate.clientMutationId === 'string' &&
    /^[a-zA-Z0-9_-]{8,64}$/.test(candidate.clientMutationId) &&
    Boolean(payload && ['scheduled', 'live', 'final', 'delayed', 'postponed', 'cancelled'].includes(payload.status) &&
      [payload.homeScore, payload.awayScore].every((score) => score === null || Number.isInteger(score)) &&
      (payload.reason === undefined || typeof payload.reason === 'string') &&
      (payload.statusNote === null || typeof payload.statusNote === 'string')) &&
    Number.isInteger(candidate.attempts) && Number.isFinite(candidate.nextRetryAt) &&
    ['pending', 'paused_auth', 'conflict', 'validation_error', 'forbidden'].includes(candidate.state ?? '')
  )
}
