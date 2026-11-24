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
  vi.spyOn(api, 'adminGames').mockResolvedValue({ games: [], availableDates: [], requestedDate: null, nextScheduledDate: null, pendingCorrectionCount: 0 })
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
  fireEvent.click(screen.getByRole('button', { name: 'Events & Updates' }))
  expect(screen.queryByRole('group', { name: 'Food & Drink Menu' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Menu & Spotlight' }))
  expect(screen.getByDisplayValue('Iced tea')).toBeVisible()
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
  fireEvent.click(await screen.findByRole('button', { name: 'Events & Updates' }))
  const news = within((await screen.findByRole('heading', { name: 'Post an update' })).closest('.panel') as HTMLElement)
  fireEvent.change(news.getByLabelText('Update title'), { target: { value: announcement.title } })
  fireEvent.change(news.getByLabelText('Update body'), { target: { value: announcement.body } })
  fireEvent.click(news.getByRole('button', { name: 'Use selected night' }))
  fireEvent.click(news.getByRole('button', { name: 'Publish update' }))
  expect(await news.findByText('Update published')).toBeInTheDocument()
  expect(post).toHaveBeenCalledWith('1', expect.objectContaining({ title: announcement.title, targetDate: date, status: 'published' }))
  expect(await news.findByText(announcement.title)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Alerts & Guide' }))
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

it('uploads spotlight and gallery images, retains successful files in the draft, and saves captions', async () => {
  const presign = vi.spyOn(api, 'adminPresignImageUpload').mockImplementation(async ({ filename }) => ({
    uploadUrl: `https://s3.example.test/${filename}`, fields: { Policy: 'test-policy' },
    publicUrl: `https://cdn.example.test/${filename}`, key: filename, maxBytes: 10_000_000, expiresIn: 60,
  }))
  const putFile = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => new Response(null, {
    status: String(url).endsWith('denied.png') ? 403 : 204,
  }))
  const save = vi.spyOn(api, 'adminSaveGameDayNote').mockImplementation(async (draft) => ({ gameDayNote: { ...note, ...draft } }))
  const image = (name: string) => new File(['image'], name, { type: 'image/png' })

  const view = open()
  const spotlight = await screen.findByLabelText('Upload photo')
  expect(screen.queryByText(/Legacy menu/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Legacy announcement/)).not.toBeInTheDocument()
  fireEvent.change(spotlight, { target: { files: [image('host.png')] } })
  expect(screen.getByRole('button', { name: /^Save draft ·/ })).toBeDisabled()
  expect(await screen.findByAltText('Spotlight photo preview')).toHaveAttribute('src', 'https://cdn.example.test/host.png')
  fireEvent.click(screen.getByRole('button', { name: 'Remove spotlight photo' }))
  expect(screen.queryByAltText('Spotlight photo preview')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [image('new-host.png')] } })
  await screen.findByLabelText('Replace photo')

  fireEvent.click(screen.getByRole('button', { name: 'Photos & Flyers' }))
  fireEvent.change(screen.getByLabelText(/Upload photos or flyers/), {
    target: { files: [image('flyer.png'), image('denied.png'), image('remove.png')] },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Events & Updates' }))
  expect(screen.getByText('Uploading images…')).toBeVisible()
  expect(presign.mock.calls.at(-1)?.[1]?.aborted).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Photos & Flyers' }))
  expect(await screen.findByText(/Could not upload denied.png/)).toBeInTheDocument()
  expect(screen.getAllByLabelText(/Caption for image/)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Remove image 2' }))
  fireEvent.change(screen.getByLabelText('Caption for image 1'), { target: { value: 'Tonight’s flyer' } })
  view.unmount()

  open()
  expect(await screen.findByDisplayValue('Tonight’s flyer')).toBeInTheDocument()
  expect(screen.getByAltText('Spotlight photo preview')).toHaveAttribute('src', 'https://cdn.example.test/new-host.png')
  expect(presign).toHaveBeenCalledTimes(5)
  expect(presign).toHaveBeenCalledWith(expect.objectContaining({ tournamentId: '1', purpose: 'tonight-photo', filename: 'flyer.png' }), expect.any(AbortSignal))
  expect(putFile).toHaveBeenCalledWith('https://s3.example.test/flyer.png', expect.objectContaining({
    method: 'POST', body: expect.any(FormData),
  }))
  fireEvent.click(screen.getByRole('button', { name: /^Save draft ·/ }))
  const photos = [{ url: 'https://cdn.example.test/flyer.png', caption: 'Tonight’s flyer' }]
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
    hostSpotlight: { photoUrl: 'https://cdn.example.test/new-host.png' }, photos,
  })))
  expect(await screen.findByText('Draft saved')).toBeInTheDocument()
})

it('opens a scheduled night in one click, cancels an in-flight upload, and exposes existing legacy copy', async () => {
  const alternative = '2032-07-03'
  const original = await api.adminGameDay()
  vi.mocked(api.adminGameDay).mockImplementation(async ({ date: selected } = {}) => ({
    ...original,
    date: selected || date,
    scheduledDates: [alternative],
    gameDayNote: selected === alternative ? { ...note, date: alternative, foodMenu: 'Legacy BBQ', announcement: 'Use the west lot' } : null,
  }))
  const presign = vi.spyOn(api, 'adminPresignImageUpload').mockImplementation((_payload, signal) =>
    new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true })),
  )

  open()
  const spotlight = await screen.findByLabelText('Upload photo')
  fireEvent.change(spotlight, { target: { files: [new File(['image'], 'host.png', { type: 'image/png' })] } })
  const shortcut = screen.getByRole('button', { name: 'Sat, Jul 3' })
  fireEvent.click(shortcut)

  expect(await screen.findByDisplayValue('Legacy BBQ')).toBeInTheDocument()
  expect(screen.getByText('Legacy announcement & sponsor copy')).toBeInTheDocument()
  expect(shortcut).toHaveAttribute('aria-pressed', 'true')
  expect(presign.mock.calls[0][1]?.aborted).toBe(true)
  expect(localStorage.getItem(`fd-tonight-draft:1:${date}`)).toBeNull()
})
