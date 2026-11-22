import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api, ApiError } from '../../lib/api'
import { toLocalDateTimeInputValue } from '../../lib/datetime'
import type { GameDayNote, TonightPayload, Tournament, TournamentAlert } from '../../lib/types'
import { AdminGameDayPage } from './AdminGameDayPage'

vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { isSuperAdmin: true } }) }))

const tournament: Tournament = { id: '1', year: 2032, name: 'FD Alumni Cup', startDate: '2032-07-01', endDate: '2032-07-31', status: 'live' }
const date = toLocalDateTimeInputValue(new Date().toISOString()).slice(0, 10)
const alert: TournamentAlert = {
  id: 'alert1', tournamentId: '1', title: 'Gym closure', message: 'Doors are closed.', severity: 'urgent', active: true, startsAt: null, expiresAt: null,
}
const note: GameDayNote = {
  id: 'note1', tournamentId: '1', date, active: true, foodMenu: null, announcement: null, hostClass: null, sponsorShoutout: null,
  menuItems: [{ name: 'Previous plate', price: '$10', available: true }], status: 'draft', lockVersion: 0,
}

function open() {
  return render(<MemoryRouter><AdminGameDayPage /></MemoryRouter>)
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(api, 'adminTournaments').mockResolvedValue({ tournaments: [tournament] })
  vi.spyOn(api, 'adminGames').mockResolvedValue({ games: [] })
  vi.spyOn(api, 'adminGameDay').mockResolvedValue({
    tournament, date, gameDayNote: null, games: [], predictionPolls: [],
    infoGuide: {
      venueName: 'Phoenix Center', venueAddress: '', ticketSourceName: 'HåfaPass', ticketSourceUrl: '/tickets', ticketSummary: '',
      doorInfo: '', eligibilityHighlights: [], gameRuleHighlights: [], conductHighlights: [], bylawDisclaimer: '',
    },
  })
  vi.spyOn(api, 'adminTournamentUpdates').mockResolvedValue({ updates: [] })
  vi.spyOn(api, 'adminAlerts').mockResolvedValue({ alerts: [alert] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

it('copies the preceding menu, preserves local edits, and publishes the selected Guam date', async () => {
  const copy = vi.spyOn(api, 'adminCopyPreviousMenu').mockResolvedValue({ gameDayNote: note })
  const save = vi.spyOn(api, 'adminSaveGameDayNote').mockResolvedValue({ gameDayNote: { ...note, status: 'published' } })
  const preview: TonightPayload = {
    tournament, date, requestedDate: date, resolvedDate: date, isRestDay: true, nextScheduledDate: null,
    gameDayNote: note, games: [], linkedCampaignEvents: [], updates: [], predictionPolls: [], sponsors: [], lastUpdatedAt: null,
  }
  const loadPreview = vi.spyOn(api, 'adminPreviewNight').mockResolvedValue(preview)

  const view = open()
  fireEvent.click(await screen.findByRole('button', { name: /Copy last night’s menu/ }))
  expect(await screen.findByDisplayValue('Previous plate')).toBeInTheDocument()
  expect(copy).toHaveBeenCalledWith('1', date, null)
  fireEvent.click(screen.getByRole('button', { name: 'Add menu item' }))
  fireEvent.change(screen.getAllByLabelText('Item name')[1], { target: { value: 'Iced tea' } })
  view.unmount()
  open()
  expect(await screen.findByDisplayValue('Iced tea')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Preview this night ·/ }))
  expect(await screen.findByRole('region', { name: 'Night preview' })).toHaveTextContent('Iced tea')
  expect(loadPreview).toHaveBeenCalledWith('1', date)

  fireEvent.click(screen.getByRole('button', { name: /^Publish ·/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    tournamentId: '1', date, status: 'published', lockVersion: 0,
    menuItems: [expect.objectContaining({ name: 'Previous plate' }), expect.objectContaining({ name: 'Iced tea' })],
  })))
  expect(await screen.findByText('Night published')).toBeInTheDocument()
})

it('offers current data and preserves edits on a stale save', async () => {
  const save = vi.spyOn(api, 'adminSaveGameDayNote').mockRejectedValueOnce(new ApiError('Changed', 409, { currentNote: note }))
    .mockResolvedValue({ gameDayNote: { ...note, menuItems: [{ name: 'My plate' }] } })
  open()
  fireEvent.click(await screen.findByRole('button', { name: 'Add menu item' }))
  fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'My plate' } })
  fireEvent.click(screen.getByRole('button', { name: /^Save draft ·/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Keep my edits' }))
  expect(screen.getByDisplayValue('My plate')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^Save draft ·/ }))
  await waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ lockVersion: 0, status: 'draft' })))
})

it('keeps routine posts and urgent alerts distinct and removes a live alert in one click', async () => {
  const update = vi.spyOn(api, 'adminUpdateAlert').mockResolvedValue({ alert: { ...alert, active: false } })
  const announcement = {
    id: '1', tournamentId: '1', title: 'Parking update', body: 'Use the west lot.', targetDate: date,
    status: 'published', publishedAt: date, expiresAt: null, pinned: false,
  } as const
  const post = vi.spyOn(api, 'adminSaveTournamentUpdate').mockResolvedValue({ update: announcement })
  vi.mocked(api.adminTournamentUpdates).mockResolvedValueOnce({ updates: [] }).mockResolvedValue({ updates: [announcement] })
  const postAlert = vi.spyOn(api, 'adminCreateAlert').mockResolvedValue({ alert })
  vi.mocked(api.adminAlerts).mockResolvedValueOnce({ alerts: [alert] })
    .mockResolvedValueOnce({ alerts: [alert] }).mockResolvedValue({ alerts: [{ ...alert, active: false }] })

  open()
  const news = within((await screen.findByRole('heading', { name: 'Post an update' })).closest('.panel') as HTMLElement)
  fireEvent.change(news.getByLabelText('Update title'), { target: { value: announcement.title } })
  fireEvent.change(news.getByLabelText('Update body'), { target: { value: announcement.body } })
  fireEvent.click(news.getByRole('button', { name: 'Use selected night' }))
  fireEvent.click(news.getByRole('button', { name: 'Publish update' }))
  expect(await news.findByText('Update published')).toBeInTheDocument()
  expect(post).toHaveBeenCalledWith('1', expect.objectContaining({ title: announcement.title, targetDate: date, status: 'published' }))
  expect(await news.findByText(announcement.title)).toBeInTheDocument()

  const urgent = within(screen.getByRole('heading', { name: 'Post an urgent alert' }).closest('.panel') as HTMLElement)
  fireEvent.change(urgent.getByLabelText('Title'), { target: { value: alert.title } })
  fireEvent.change(urgent.getByLabelText('Message'), { target: { value: alert.message } })
  fireEvent.change(urgent.getByLabelText('Severity'), { target: { value: 'urgent' } })
  fireEvent.click(urgent.getByRole('button', { name: 'Publish alert' }))
  expect(await urgent.findByText('Alert published')).toBeInTheDocument()
  expect(postAlert).toHaveBeenCalledWith(expect.objectContaining({ tournamentId: '1', severity: 'urgent' }))

  fireEvent.click(await urgent.findByRole('button', { name: 'Remove alert' }))
  expect(update).toHaveBeenCalledWith('alert1', { active: false })
  expect(await urgent.findByText('Alert removed')).toBeInTheDocument()
  expect(await urgent.findByRole('button', { name: 'Activate' })).toBeInTheDocument()
  expect(screen.getByText('Optional fan polls').closest('details')).not.toHaveAttribute('open')
})
