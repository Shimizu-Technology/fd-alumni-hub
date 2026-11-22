import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, ApiError } from '../../lib/api'
import { toLocalDateTimeInputValue } from '../../lib/datetime'
import { readScoreQueue } from '../../lib/scoreQueue'
import type { CurrentUser, Game, ScoreCorrectionRequest, Tournament } from '../../lib/types'
import { AdminScorekeeperPage } from './AdminScorekeeperPage'

let user: CurrentUser
vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user }) }))

const date = '2031-07-03'
const nextDate = '2031-07-07'
const tournament: Tournament = { id: '5', name: 'FD Summer Tournament', year: 2031, startDate: date, endDate: '2031-07-15', status: 'live' }
const game: Game = {
  id: '42', tournamentId: '5', homeTeamId: '10', awayTeamId: '11', startTime: `${date}T18:00:00+10:00`,
  status: 'scheduled', homeScore: null, awayScore: null, division: 'Maroon', gameNumber: 'P1',
  streamUrl: null, ticketUrl: null, venue: 'The Jungle', notes: null, bracketCode: null, lockVersion: 1,
  homeTeam: { id: '10', displayName: 'Red Alumni', division: 'Maroon', classYearLabel: 'Red', classCohorts: [] },
  awayTeam: { id: '11', displayName: 'Gold Alumni', division: 'Maroon', classYearLabel: 'Gold', classCohorts: [] },
}
const saved: Game = { ...game, status: 'final', homeScore: 20, awayScore: 15, lockVersion: 2 }
const fixtures = (games: Game[], requestedDate: string | null = date) => ({
  games, requestedDate, nextScheduledDate: nextDate, availableDates: [date, nextDate], pendingCorrectionCount: 0,
})

function open(search = `?tournamentId=5&date=${date}`) {
  return render(<MemoryRouter initialEntries={[`/admin/scorekeeper${search}`]}><AdminScorekeeperPage /></MemoryRouter>)
}

function online(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')) })
}

function enter(card: HTMLElement, home: string, away: string) {
  fireEvent.change(within(card).getByRole('textbox', { name: /^Home score/ }), { target: { value: home } })
  fireEvent.change(within(card).getByRole('textbox', { name: /^Away score/ }), { target: { value: away } })
  fireEvent.click(within(card).getByRole('checkbox', { name: 'Final' }))
}

beforeEach(() => {
  localStorage.clear()
  user = {
    id: '12', clerkId: 'clerk-12', email: 'volunteer@example.test', firstName: 'Gym', lastName: 'Volunteer',
    fullName: 'Gym Volunteer', role: 'scorekeeper', active: true, isAdmin: false, isStaff: false, isScorekeeper: true,
    capabilities: [{ capability: 'scores_and_stats', actions: ['view', 'edit', 'request_correction'], scopeType: 'tournament', scopeIds: ['5'], allScopes: false }],
  }
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.spyOn(api, 'adminTournaments').mockResolvedValue({ tournaments: [tournament] })
  vi.spyOn(api, 'adminGames').mockResolvedValue(fixtures([game]))
  vi.spyOn(api, 'adminScoreCorrectionRequests').mockResolvedValue({ correctionRequests: [] })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})

it('opens on the Guam date and requires an explicit jump to the next scheduled night', async () => {
  const tonight = toLocalDateTimeInputValue(new Date().toISOString()).slice(0, 10)
  const query = vi.mocked(api.adminGames)
  query.mockImplementation(async (_, filters) => filters?.date === nextDate
    ? fixtures([{ ...game, startTime: `${nextDate}T18:00:00+10:00` }], nextDate) : fixtures([], tonight))
  open('')
  expect(await screen.findByText('No games on this Guam date')).toBeVisible()
  expect(query).toHaveBeenCalledWith('5', { date: tonight, unscoredOnly: undefined })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Next scheduled night/ }))
  expect(await screen.findByRole('article', { name: 'Gold Alumni at Red Alumni' })).toBeVisible()
  expect(query).toHaveBeenLastCalledWith('5', { date: nextDate, unscoredOnly: undefined })
})

it('validates blank separately from deliberate zero and restores a draft after switching dates and reloading', async () => {
  const send = vi.spyOn(api, 'adminScoreGame').mockResolvedValue({ game: { ...saved, homeScore: 0 } })
  const view = open(`?tournamentId=5&date=${date}&gameId=42`)
  const card = await screen.findByRole('article')
  const away = within(card).getByRole('textbox', { name: /^Away score/ })
  expect(away).toHaveValue('')
  enter(card, '0', '')
  fireEvent.click(within(card).getByRole('button', { name: 'Save result' }))
  expect(await within(card).findByText('Enter both scores to finalize this game.')).toBeVisible()
  expect(send).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Choose another date'), { target: { value: nextDate } })
  await waitFor(() => expect(api.adminGames).toHaveBeenLastCalledWith('5', { date: nextDate, unscoredOnly: undefined }))
  view.unmount()
  open()
  const restored = await screen.findByRole('article')
  expect(within(restored).getByRole('textbox', { name: /^Home score/ })).toHaveValue('0')
  expect(within(restored).getByRole('textbox', { name: /^Away score/ })).toHaveValue('')
  fireEvent.change(within(restored).getByRole('textbox', { name: /^Away score/ }), { target: { value: '15' } })
  fireEvent.click(within(restored).getByRole('button', { name: 'Save result' }))
  await waitFor(() => expect(send).toHaveBeenCalledWith('42', expect.objectContaining({ homeScore: 0, awayScore: 15, status: 'final', lockVersion: 1 })))
  expect(await screen.findByText('Saved and published')).toBeVisible()
})

it('reviews multiple drafts together, publishes the successful row and retains the row requiring review', async () => {
  const second = { ...game, id: '43', gameNumber: 'P2' }
  vi.mocked(api.adminGames).mockResolvedValue(fixtures([game, second]))
  const batch = vi.spyOn(api, 'adminBatchResults').mockResolvedValue({
    results: [
      { gameId: '42', ok: true, status: 200, game: saved },
      { gameId: '43', ok: false, status: 422, errors: ['Check official scores.'] },
    ],
    standingsStatus: 'updated',
  })
  open()
  const cards = await screen.findAllByRole('article')
  enter(cards[0], '20', '15')
  enter(cards[1], '12', '0')
  fireEvent.click(screen.getByRole('button', { name: 'Review & save 2 results' }))
  const review = screen.getByRole('region', { name: 'Review results' })
  expect(review).toHaveTextContent('Home 20 – 15 Away · Regulation · final')
  expect(review).toHaveTextContent('Home 12 – 0 Away')
  fireEvent.click(within(review).getByRole('button', { name: 'Confirm and save results' }))
  await waitFor(() => expect(batch).toHaveBeenCalledExactlyOnceWith([
    expect.objectContaining({ gameId: '42', clientMutationId: expect.any(String), homeScore: 20, awayScore: 15 }),
    expect.objectContaining({ gameId: '43', clientMutationId: expect.any(String), homeScore: 12, awayScore: 0 }),
  ], '5'))
  expect(await within(cards[1]).findByText('Check official scores.')).toBeVisible()
  expect(within(cards[0]).getByText('Saved and published')).toBeVisible()
  expect(readScoreQueue(user.id).map((entry) => entry.gameId)).toEqual(['43'])
  expect(screen.getByRole('button', { name: 'Review & save 1 result' })).toBeVisible()
})

it('queues an offline result, compares conflicting finals and rebases with a reason', async () => {
  user.isSuperAdmin = true
  online(false)
  const server = { ...saved, homeScore: 22, awayScore: 14, lockVersion: 5 }
  const conflict = vi.spyOn(api, 'adminBatchResults').mockResolvedValue({
    results: [{ gameId: '42', ok: false, status: 409, currentGame: server, error: 'Stale score' }],
  })
  const send = vi.spyOn(api, 'adminScoreGame').mockResolvedValue({ game: { ...saved, lockVersion: 6 } })
  const view = open()
  const card = await screen.findByRole('article')
  enter(card, '20', '15')
  fireEvent.click(within(card).getByRole('button', { name: 'Save result' }))
  expect(send).not.toHaveBeenCalled()
  expect(readScoreQueue(user.id)[0].state).toBe('pending')

  view.unmount()
  open()
  expect(await screen.findByText('Saved on this device · waiting to sync')).toBeVisible()
  online(true)
  expect(await screen.findByText('Server saved score')).toBeVisible()
  expect(screen.getByText('Your proposed score')).toBeVisible()
  expect(screen.getByText('22 – 14 · final')).toBeVisible()
  expect(screen.getByText('20 – 15 · final')).toBeVisible()
  const rebase = screen.getByRole('button', { name: 'Submit correction against latest version' })
  expect(rebase).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Correction reason'), { target: { value: 'Checked scorebook' } })
  fireEvent.click(rebase)
  const originalId = conflict.mock.calls[0][0][0].clientMutationId
  await waitFor(() => expect(send).toHaveBeenCalledWith('42', expect.objectContaining({
    lockVersion: 5, homeScore: 20, reason: 'Checked scorebook',
  })))
  expect(send.mock.calls[0][1]).not.toHaveProperty('forceOverwrite')
  expect(send.mock.calls[0][1].clientMutationId).not.toBe(originalId)
  expect(await screen.findByText('Saved and published')).toBeVisible()
})

it('lets a volunteer request a correction and staff approve it or enter their own correction', async () => {
  vi.mocked(api.adminGames).mockResolvedValue(fixtures([saved]))
  const request: ScoreCorrectionRequest = {
    id: '19', game: saved, requestedBy: 'Gym Volunteer', status: 'pending',
    proposedHomeScore: 21, proposedAwayScore: 15, proposedStatus: 'final', proposedResultOutcome: 'regulation',
    proposedOfficialWinnerTeamId: null, proposedStatusNote: null, reason: 'Table confirmed',
  }
  const submit = vi.spyOn(api, 'adminRequestScoreCorrection').mockResolvedValue({ correctionRequest: request })
  const volunteer = open()
  fireEvent.click(await screen.findByRole('button', { name: 'Request correction' }))
  expect(screen.queryByRole('button', { name: 'Correct final score' })).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox', { name: /^Home score/ }), { target: { value: '21' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: request.reason } })
  fireEvent.click(screen.getByRole('button', { name: 'Send correction request' }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith('42', expect.objectContaining({ homeScore: 21, awayScore: 15, reason: request.reason })))
  expect(await screen.findByText('Correction requested')).toBeVisible()
  volunteer.unmount()

  user = { ...user, isSuperAdmin: true, id: '20' }
  vi.mocked(api.adminScoreCorrectionRequests).mockResolvedValueOnce({ correctionRequests: [request] })
  const approve = vi.spyOn(api, 'adminResolveScoreCorrection').mockResolvedValue({
    correctionRequest: { ...request, status: 'approved' }, game: { ...saved, homeScore: 21, lockVersion: 3 },
  })
  const send = vi.spyOn(api, 'adminScoreGame').mockResolvedValue({ game: { ...saved, homeScore: 25, lockVersion: 4 } })
  open()
  expect(await screen.findByRole('heading', { name: 'Pending correction requests (1)' })).toBeVisible()
  fireEvent.click(screen.getByText('Gold Alumni at Red Alumni', { selector: 'summary strong' }).closest('summary')!)
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(approve).toHaveBeenCalledWith('19', 'approve', undefined))
  fireEvent.click(await screen.findByRole('button', { name: 'Correct final score' }))
  fireEvent.change(screen.getByRole('textbox', { name: /^Home score/ }), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save result' }))
  expect(await screen.findByText('Enter a correction reason of at least 3 characters.')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Check final scorebook' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save result' }))
  await waitFor(() => expect(send).toHaveBeenCalledWith('42', expect.objectContaining({ homeScore: 25, lockVersion: 3, reason: 'Check final scorebook' })))
})
