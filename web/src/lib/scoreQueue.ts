import { ApiError } from './api'
import type { Game, GameStatus } from './types'

export const SCORE_QUEUE_STORAGE_PREFIX = 'fd_score_queue_v1:'
export const SCORE_QUEUE_BACKOFF_MS = [5_000, 15_000, 30_000] as const

export type ScoreMutationPayload = {
  homeScore: number | null
  awayScore: number | null
  status: GameStatus
  statusNote: string | null
  lockVersion?: number
  forceOverwrite?: boolean
}

export type ScoreQueueItemState =
  | 'pending'
  | 'paused_auth'
  | 'conflict'
  | 'validation_error'
  | 'forbidden'

export type QueuedScoreItem = {
  gameId: string
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
) => Promise<{ game: Game; idempotentReplay?: boolean }>

export type FlushScoreQueueResult = {
  syncedGames: Game[]
  remaining: QueuedScoreItem[]
  pausedForAuth: boolean
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
    forceOverwrite: Boolean(payload.forceOverwrite),
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
    return parsed.filter(isValidQueueItem)
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
    storage = defaultStorage(),
    idGenerator = createMutationId,
    now = Date.now(),
  }: {
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
    forceOverwrite: Boolean(payload.forceOverwrite),
  }

  // Always mint a fresh clientMutationId whenever the payload changes so a subsequent
  // edit after a dropped response is never swallowed as an idempotent replay (H4).
  const payloadUnchanged =
    existing &&
    normalizedScoreKey(existing.payload) === normalizedScoreKey(normalizedPayload)

  const nextItem: QueuedScoreItem = {
    gameId,
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

export function resolveConflictKeepMine(
  userId: string,
  gameId: string,
  serverLockVersion?: number,
  {
    storage = defaultStorage(),
    idGenerator = createMutationId,
    now = Date.now(),
  }: {
    storage?: Storage | null
    idGenerator?: () => string
    now?: number
  } = {},
): QueuedScoreItem[] {
  const current = readScoreQueue(userId, storage)
  const updated = current.map((item) => {
    if (item.gameId !== gameId) return item
    return {
      ...item,
      clientMutationId: idGenerator(),
      payload: {
        ...item.payload,
        lockVersion: serverLockVersion ?? item.payload.lockVersion,
        forceOverwrite: true,
      },
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
  }: {
    storage?: Storage | null
    now?: number
    force?: boolean
  } = {},
): Promise<FlushScoreQueueResult> {
  const items = readScoreQueue(userId, storage)
  const syncedGames: Game[] = []
  const remaining: QueuedScoreItem[] = []
  let pausedForAuth = false

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]

    if (pausedForAuth) {
      remaining.push(item)
      continue
    }

    const eligible =
      item.state === 'pending' ||
      (force && item.state === 'paused_auth')

    if (!eligible) {
      remaining.push(item)
      continue
    }

    if (!force && item.nextRetryAt > now) {
      remaining.push(item)
      continue
    }

    try {
      const response = await sendFn(item.gameId, {
        ...item.payload,
        clientMutationId: item.clientMutationId,
      })
      syncedGames.push(response.game)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          pausedForAuth = true
          remaining.push({
            ...item,
            state: 'paused_auth',
            errorMessage: 'Session expired — sign in again to sync pending scores.',
          })
          continue
        }

        if (err.status === 403) {
          remaining.push({
            ...item,
            state: 'forbidden',
            errorMessage: err.message || 'You do not have permission to update this game score.',
          })
          continue
        }

        if (err.status === 422) {
          remaining.push({
            ...item,
            state: 'validation_error',
            errorMessage: err.message || 'Invalid score payload. Check the score and status values.',
          })
          continue
        }

        if (err.status === 409) {
          const payload = err.payload as { currentGame?: Game } | null
          remaining.push({
            ...item,
            state: 'conflict',
            errorMessage: err.message || 'Score was updated by another user.',
            serverGame: payload?.currentGame ?? null,
          })
          continue
        }
      }

      // Network error, timeout, or 5xx: retain in pending state with bounded exponential backoff.
      const backoffIndex = Math.min(item.attempts, SCORE_QUEUE_BACKOFF_MS.length - 1)
      const delayMs = SCORE_QUEUE_BACKOFF_MS[backoffIndex]
      remaining.push({
        ...item,
        state: 'pending',
        attempts: item.attempts + 1,
        nextRetryAt: now + delayMs,
        errorMessage: err instanceof Error ? err.message : 'Network unavailable — will retry automatically.',
      })
    }
  }

  writeScoreQueue(userId, remaining, storage)
  return { syncedGames, remaining, pausedForAuth }
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
  return (
    typeof candidate.gameId === 'string' &&
    typeof candidate.clientMutationId === 'string' &&
    Boolean(candidate.payload) &&
    typeof candidate.state === 'string'
  )
}
