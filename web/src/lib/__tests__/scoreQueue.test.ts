import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api'
import {
  dismissQueueItem,
  enqueueScoreMutation,
  flushScoreQueue,
  readScoreQueue,
  rebaseScoreConflict,
  resolveConflictUseServer,
  SCORE_QUEUE_BACKOFF_MS,
} from '../scoreQueue'
import type { Game } from '../types'

function createMemoryStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: '42',
    tournamentId: '1',
    homeTeamId: '10',
    awayTeamId: '20',
    startTime: '2027-06-25T09:00:00Z',
    venue: 'FD Phoenix Center',
    status: 'live',
    homeScore: 44,
    awayScore: 40,
    streamUrl: null,
    ticketUrl: null,
    notes: null,
    division: 'Maroon',
    bracketCode: null,
    lockVersion: 3,
    ...overrides,
  }
}

describe('scoreQueue', () => {
  it('isolates storage by userId and mints a fresh clientMutationId whenever payload changes', () => {
    const storage = createMemoryStorage()
    let counter = 0
    const nextId = () => `mut-uuid-000${++counter}`

    enqueueScoreMutation('user-a', '42', { homeScore: 10, awayScore: 8, status: 'live', statusNote: null }, { storage, idGenerator: nextId })
    enqueueScoreMutation('user-b', '42', { homeScore: 5, awayScore: 2, status: 'live', statusNote: null }, { storage, idGenerator: nextId })

    expect(readScoreQueue('user-a', storage)).toHaveLength(1)
    expect(readScoreQueue('user-b', storage)).toHaveLength(1)
    expect(readScoreQueue('user-a', storage)[0].clientMutationId).toBe('mut-uuid-0001')

    // Identical payload keeps same clientMutationId for idempotent retry
    enqueueScoreMutation('user-a', '42', { homeScore: 10, awayScore: 8, status: 'live', statusNote: null }, { storage, idGenerator: nextId })
    expect(readScoreQueue('user-a', storage)[0].clientMutationId).toBe('mut-uuid-0001')

    // Payload change (+2 tap) MUST mint a fresh clientMutationId
    enqueueScoreMutation('user-a', '42', { homeScore: 12, awayScore: 8, status: 'live', statusNote: null }, { storage, idGenerator: nextId })
    const updated = readScoreQueue('user-a', storage)
    expect(updated).toHaveLength(1)
    expect(updated[0].clientMutationId).toBe('mut-uuid-0003')
    expect(updated[0].payload.homeScore).toBe(12)
  })

  it('handles 401 by pausing and retaining queued scores, then resumes on force flush', async () => {
    const storage = createMemoryStorage()
    enqueueScoreMutation('user-1', '10', { homeScore: 20, awayScore: 18, status: 'live', statusNote: null }, { storage, idGenerator: () => 'mut-401-aaaa' })
    enqueueScoreMutation('user-1', '11', { homeScore: 30, awayScore: 25, status: 'live', statusNote: null }, { storage, idGenerator: () => 'mut-401-bbbb' })

    const send401 = vi.fn().mockRejectedValue(new ApiError('Expired token', 401, { error: 'Expired' }))
    const res1 = await flushScoreQueue('user-1', send401, { storage, now: 1_000 })

    expect(res1.pausedForAuth).toBe(true)
    expect(send401).toHaveBeenCalledTimes(1)
    expect(res1.remaining).toHaveLength(2)
    expect(res1.remaining[0].state).toBe('paused_auth')
    expect(res1.remaining[1].state).toBe('paused_auth')

    const sendOk = vi.fn().mockImplementation(async (gameId) => ({ game: makeGame({ id: gameId }) }))
    const res2 = await flushScoreQueue('user-1', sendOk, { storage, now: 2_000, force: true })
    expect(res2.pausedForAuth).toBe(false)
    expect(res2.syncedGames).toHaveLength(2)
    expect(readScoreQueue('user-1', storage)).toEqual([])
  })

  it('stops retrying 403 and 422 items and allows dismissal', async () => {
    const storage = createMemoryStorage()
    enqueueScoreMutation('user-1', '10', { homeScore: 20, awayScore: 18, status: 'live', statusNote: null }, { storage, idGenerator: () => 'mut-403-aaaa' })
    enqueueScoreMutation('user-1', '11', { homeScore: null, awayScore: null, status: 'final', statusNote: null }, { storage, idGenerator: () => 'mut-422-bbbb' })

    const send = vi.fn().mockImplementation(async (gameId) => {
      if (gameId === '10') throw new ApiError('Finalized games require staff', 403, {})
      throw new ApiError('Both scores required', 422, {})
    })

    const res = await flushScoreQueue('user-1', send, { storage, now: 1_000 })
    expect(res.remaining.find((i) => i.gameId === '10')?.state).toBe('forbidden')
    expect(res.remaining.find((i) => i.gameId === '11')?.state).toBe('validation_error')

    // Next flush must NOT retry 403 or 422
    const sendAgain = vi.fn()
    await flushScoreQueue('user-1', sendAgain, { storage, now: 100_000, force: true })
    expect(sendAgain).not.toHaveBeenCalled()

    dismissQueueItem('user-1', '10', storage)
    expect(readScoreQueue('user-1', storage).map((i) => i.gameId)).toEqual(['11'])
  })

  it('captures 409 conflict serverGame and supports both Use Server and Keep Mine resolutions', async () => {
    const storage = createMemoryStorage()
    let counter = 0
    const nextId = () => `mut-409-000${++counter}`

    enqueueScoreMutation('user-1', '42', { homeScore: 55, awayScore: 50, status: 'live', statusNote: null, lockVersion: 1 }, { storage, idGenerator: nextId })

    const serverGame = makeGame({ id: '42', homeScore: 53, awayScore: 50, lockVersion: 2 })
    const send409 = vi.fn().mockRejectedValue(new ApiError('Conflict', 409, { currentGame: serverGame }))

    const res = await flushScoreQueue('user-1', send409, { storage, now: 1_000 })
    expect(res.remaining[0].state).toBe('conflict')
    expect(res.remaining[0].serverGame?.homeScore).toBe(53)

    // Rebasing mints a fresh mutation ID and preserves optimistic locking.
    const kept = rebaseScoreConflict('user-1', '42', { storage, idGenerator: nextId, now: 2_000 })
    expect(kept[0].state).toBe('pending')
    expect(kept[0].payload).not.toHaveProperty('forceOverwrite')
    expect(kept[0].payload.lockVersion).toBe(2)
    expect(kept[0].clientMutationId).toBe('mut-409-0002')

    // Use Server removes the queued item completely
    resolveConflictUseServer('user-1', '42', storage)
    expect(readScoreQueue('user-1', storage)).toEqual([])
  })

  it('retains original mutation IDs and outcome details after a dropped batch response', async () => {
    const storage = createMemoryStorage()
    const payload = {
      homeScore: null, awayScore: null, status: 'postponed' as const, statusNote: 'Court unavailable',
      resultOutcome: 'postponed' as const, startTime: '2031-07-06T08:00:00Z', reason: 'Confirmed by staff', lockVersion: 5,
    }
    enqueueScoreMutation('user-1', '42', payload, { storage, tournamentId: '1', idGenerator: () => 'mut-batch-42' })
    enqueueScoreMutation('user-1', '43', payload, { storage, tournamentId: '2', idGenerator: () => 'mut-batch-43' })
    const single = vi.fn()
    const batch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Connection dropped'))
      .mockResolvedValueOnce({ results: [{ gameId: '42', ok: true, status: 200, game: makeGame(), idempotentReplay: true }] })
    await flushScoreQueue('user-1', single, { storage, tournamentId: '1', sendBatch: batch, now: 1_000 })
    expect(readScoreQueue('user-1', storage).map((item) => item.attempts)).toEqual([1, 0])

    const result = await flushScoreQueue('user-1', single, { storage, tournamentId: '1', sendBatch: batch, now: 20_000 })
    const rows = [{ ...payload, gameId: '42', clientMutationId: 'mut-batch-42' }]
    expect(batch.mock.calls).toEqual([[rows], [rows]])
    expect(result.savedResults[0].idempotentReplay).toBe(true)
    expect(result.remaining.map((item) => item.gameId)).toEqual(['43'])
    expect(single).not.toHaveBeenCalled()
  })

  it('applies bounded exponential backoff (5s -> 15s -> 30s) on network and 5xx failures', async () => {
    const storage = createMemoryStorage()
    enqueueScoreMutation('user-1', '42', { homeScore: 10, awayScore: 8, status: 'live', statusNote: null }, { storage, idGenerator: () => 'mut-net-aaaa' })

    const sendFail = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    const r1 = await flushScoreQueue('user-1', sendFail, { storage, now: 10_000 })
    expect(r1.remaining[0].attempts).toBe(1)
    expect(r1.remaining[0].nextRetryAt).toBe(10_000 + SCORE_QUEUE_BACKOFF_MS[0])

    // Before backoff expires, non-forced flush skips
    await flushScoreQueue('user-1', sendFail, { storage, now: 12_000 })
    expect(sendFail).toHaveBeenCalledTimes(1)

    const r2 = await flushScoreQueue('user-1', sendFail, { storage, now: 15_000 })
    expect(r2.remaining[0].attempts).toBe(2)
    expect(r2.remaining[0].nextRetryAt).toBe(15_000 + SCORE_QUEUE_BACKOFF_MS[1])

    const r3 = await flushScoreQueue('user-1', sendFail, { storage, now: 30_000 })
    expect(r3.remaining[0].attempts).toBe(3)
    expect(r3.remaining[0].nextRetryAt).toBe(30_000 + SCORE_QUEUE_BACKOFF_MS[2])

    // Stays capped at 30s
    const r4 = await flushScoreQueue('user-1', sendFail, { storage, now: 60_000 })
    expect(r4.remaining[0].nextRetryAt).toBe(60_000 + SCORE_QUEUE_BACKOFF_MS[2])
  })

  it('preserves and rebases newer taps enqueued during an in-flight flush (success & failure paths)', async () => {
    const storage = createMemoryStorage()
    let counter = 0
    const nextId = () => `mut-race-000${++counter}`

    // Tap A: 2-0 at lockVersion 1
    enqueueScoreMutation('user-1', '42', { homeScore: 2, awayScore: 0, status: 'live', statusNote: null, lockVersion: 1 }, { storage, idGenerator: nextId })

    let resolveSend!: (val: { game: Game }) => void
    const sendA = vi.fn().mockImplementation(
      () => new Promise<{ game: Game }>((resolve) => { resolveSend = resolve }),
    )

    const flushPromise = flushScoreQueue('user-1', sendA, { storage, now: 1_000 })

    // While A is in flight, user taps +2 again (Tap B: 4-0) AND taps game 99!
    enqueueScoreMutation('user-1', '42', { homeScore: 4, awayScore: 0, status: 'live', statusNote: null, lockVersion: 1 }, { storage, idGenerator: nextId })
    enqueueScoreMutation('user-1', '99', { homeScore: 1, awayScore: 0, status: 'live', statusNote: null, lockVersion: 5 }, { storage, idGenerator: nextId })

    // Tap A succeeds and server advances lockVersion to 2
    resolveSend({ game: makeGame({ id: '42', homeScore: 2, awayScore: 0, lockVersion: 2 }) })
    const resSuccess = await flushPromise

    expect(resSuccess.hasNewerPending).toBe(true)
    const afterSuccess = readScoreQueue('user-1', storage)
    expect(afterSuccess.map((i) => i.gameId).sort()).toEqual(['42', '99'])
    const item42 = afterSuccess.find((i) => i.gameId === '42')!
    expect(item42.payload.homeScore).toBe(4)
    expect(item42.payload.lockVersion).toBe(2) // rebased to server lockVersion!
    expect(item42.clientMutationId).toBe('mut-race-0002')

    // Now test failure path: Tap B (4-0) fails while Tap C (6-0) arrives mid-flight -> C MUST NOT be rolled back to B!
    let rejectSend!: (err: Error) => void
    const sendB = vi.fn().mockImplementation(
      (gameId: string) => {
        if (gameId === '42') {
          return new Promise<{ game: Game }>((_resolve, reject) => { rejectSend = reject })
        }
        return Promise.resolve({ game: makeGame({ id: gameId, homeScore: 1, awayScore: 0, lockVersion: 6 }) })
      },
    )

    const failFlushPromise = flushScoreQueue('user-1', sendB, { storage, now: 2_000 })
    enqueueScoreMutation('user-1', '42', { homeScore: 6, awayScore: 0, status: 'live', statusNote: null, lockVersion: 2 }, { storage, idGenerator: nextId })
    rejectSend(new TypeError('Failed to fetch'))
    const resFail = await failFlushPromise

    expect(resFail.hasNewerPending).toBe(true)
    const afterFail = readScoreQueue('user-1', storage)
    const surviving42 = afterFail.find((i) => i.gameId === '42')!
    expect(surviving42.payload.homeScore).toBe(6)
    expect(surviving42.attempts).toBe(0)
    expect(surviving42.clientMutationId).toBe('mut-race-0004')
  })
})
