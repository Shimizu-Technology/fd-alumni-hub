import { tournamentScopedPath } from './admin'
import { guamLocalDateTimeInputToIso, toLocalDateTimeInputValue } from './datetime'
import type { ScoreMutationPayload } from './scoreQueue'
import type { Game, GameOutcome, GameStatus } from './types'

export const OUTCOME_LABELS: Record<GameOutcome, string> = {
  regulation: 'Regulation',
  overtime: 'Overtime',
  shootout: 'Shootout',
  forfeit: 'Forfeit',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
}

export const ACTIVE_GAME_STATUSES: GameStatus[] = ['scheduled', 'live', 'delayed']

export type ResultDraft = {
  game: Game
  homeScore: string
  awayScore: string
  status: GameStatus
  outcome: GameOutcome
  winner: string
  note: string
  start: string
  reason: string
}

export type ResultDrafts = Record<string, ResultDraft>

export function scorekeeperPath(game: Game) {
  return tournamentScopedPath('/admin/scorekeeper', game.tournamentId, {
    date: toLocalDateTimeInputValue(game.startTime).slice(0, 10),
    gameId: game.id,
  })
}

export function draftFromGame(game: Game): ResultDraft {
  return {
    game,
    homeScore: game.homeScore?.toString() ?? '',
    awayScore: game.awayScore?.toString() ?? '',
    status: game.status,
    outcome: game.resultOutcome ?? (game.status === 'postponed' || game.status === 'cancelled' ? game.status : 'regulation'),
    winner: game.officialWinnerTeamId ?? '',
    note: game.statusNote ?? '',
    start: '',
    reason: '',
  }
}

export function readResultDrafts(key: string, tournamentId: string): ResultDrafts {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
    return Object.fromEntries(Object.entries(data).filter(([id, entry]) => validDraft(id, entry, tournamentId)))
  } catch {
    return {}
  }
}

export function writeResultDrafts(key: string, drafts: ResultDrafts) {
  try {
    if (Object.keys(drafts).length) localStorage.setItem(key, JSON.stringify(drafts))
    else localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

function validDraft(id: string, entry: unknown, tournamentId: string) {
  if (!entry || typeof entry !== 'object') return false
  const draft = entry as Partial<ResultDraft>
  return /^\d+$/.test(id) && draft.game?.id === id && draft.game.tournamentId === tournamentId &&
    typeof draft.game.startTime === 'string' && Number.isFinite(Date.parse(draft.game.startTime)) &&
    typeof draft.game.homeTeamId === 'string' && typeof draft.game.awayTeamId === 'string' &&
    Number.isInteger(draft.game.lockVersion) && typeof draft.outcome === 'string' &&
    Object.hasOwn(OUTCOME_LABELS, draft.outcome) && typeof draft.status === 'string' &&
    [...ACTIVE_GAME_STATUSES, 'final', 'postponed', 'cancelled'].includes(draft.status) &&
    [draft.homeScore, draft.awayScore, draft.winner, draft.note, draft.start, draft.reason].every((value) => typeof value === 'string')
}

export function draftPayload(draft: ResultDraft, needsReason: boolean):
  { payload: ScoreMutationPayload; error?: never } | { payload?: never; error: string } {
  const stopped = draft.outcome === 'postponed' || draft.outcome === 'cancelled'
  const score = (value: string) => value.trim() === '' ? null : /^\d+$/.test(value.trim()) ? Number(value) : NaN
  const homeScore = stopped ? null : score(draft.homeScore)
  const awayScore = stopped ? null : score(draft.awayScore)
  if ([homeScore, awayScore].some((value) => value !== null && (!Number.isInteger(value) || value > 300))) {
    return { error: 'Enter whole numbers from 0 to 300.' }
  }

  const reason = draft.reason.trim()
  if (needsReason && reason.length < 3) return { error: 'Enter a correction reason of at least 3 characters.' }
  const isForfeit = draft.outcome === 'forfeit'
  const officialWinnerTeamId = !stopped && draft.status === 'final' ? draft.winner || null : null
  if (!stopped && draft.status === 'final') {
    if (isForfeit && !officialWinnerTeamId) return { error: 'Choose the official winner.' }
    if ((!isForfeit && (homeScore === null || awayScore === null)) || (isForfeit && (homeScore === null) !== (awayScore === null))) {
      return { error: isForfeit ? 'Enter both official scores or leave both blank.' : 'Enter both scores to finalize this game.' }
    }
    if (draft.game.phase === 'playoff' && homeScore === awayScore && !officialWinnerTeamId) {
      return { error: 'Choose the official winner for a tied playoff game.' }
    }
  }

  return {
    payload: {
      homeScore,
      awayScore,
      status: stopped ? draft.outcome as 'postponed' | 'cancelled' : draft.status,
      resultOutcome: stopped || draft.status === 'final' ? draft.outcome : null,
      officialWinnerTeamId,
      statusNote: draft.note.trim() || null,
      startTime: draft.outcome === 'postponed' && draft.start ? guamLocalDateTimeInputToIso(draft.start) : undefined,
      lockVersion: draft.game.lockVersion,
      reason: reason || undefined,
    },
  }
}
