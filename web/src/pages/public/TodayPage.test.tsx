import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { TonightPayload } from '../../lib/types'
import { TodayPage } from './TodayPage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const date = '2032-07-03'
const next = '2032-07-05'
const payload: TonightPayload = {
  tournament: null, date, scheduledDates: [date, next], requestedDate: date, resolvedDate: date, nextScheduledDate: next, isRestDay: true,
  games: [], linkedCampaignEvents: [], sponsors: [], lastUpdatedAt: null,
  alerts: [{ id: 'a1', severity: 'urgent', title: 'Weather delay', message: 'Check again soon.', active: true, tournamentId: null, startsAt: null, expiresAt: null }],
  gameDayNote: {
    id: 'n1', tournamentId: '1', date, hostClass: null, foodMenu: 'Legacy BBQ', announcement: null, sponsorShoutout: null, active: true,
    menuItems: [{ name: 'Chicken plate', price: '$12', category: 'Food', available: false }],
    specialEvents: [{ title: 'Father-Son Night' }],
    hostSpotlight: { headline: 'Meet Class of 2017', photoUrl: '/host.jpg' },
  },
  updates: [{ id: 'u1', tournamentId: '1', title: 'Parking update', body: 'Use the west lot.', targetDate: date, status: 'published', publishedAt: date, expiresAt: null, pinned: true }],
  predictionPolls: [{
    id: 'p1', tournamentId: '1', pollType: 'tournament', question: 'Who wins?', status: 'open', gameId: null, options: [], open: true, closesAt: null, totalVotes: 0, selectedTeamId: null,
  }],
}

it('places alerts and predictions above the companion sections on mobile', async () => {
  vi.spyOn(api, 'publicToday').mockResolvedValue(payload)
  render(<MemoryRouter initialEntries={[`/today?date=${date}`]}><TodayPage /></MemoryRouter>)

  await screen.findByText('Chicken plate')
  const alerts = screen.getByRole('alert')
  const hierarchy = [
    alerts, screen.getByRole('heading', { name: 'Fan Predictions' }), screen.getByRole('heading', { name: 'Host Class Spotlight' }),
    screen.getByRole('heading', { name: 'Food & Drink Menu' }), screen.getByRole('heading', { name: /Special Events/ }),
    screen.getByRole('heading', { name: 'Organizer Updates' }),
  ]
  hierarchy.slice(1).forEach((section, index) => expect(hierarchy[index].compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy())
  expect(screen.getByText('Sold out')).toBeInTheDocument()
  expect(screen.getByText('$12')).toBeInTheDocument()
  expect(screen.getByText('Father-Son Night')).toBeInTheDocument()
  expect(screen.queryByText('Legacy BBQ')).not.toBeInTheDocument()
})

it('jumps from a rest day to the next dated guide and falls back to the legacy menu', async () => {
  const fetch = vi.spyOn(api, 'publicToday').mockImplementation(async ({ date: selected } = {}) => (
    selected === next
      ? { ...payload, date: next, resolvedDate: next, requestedDate: next, updates: [], isRestDay: false, nextScheduledDate: null,
        gameDayNote: { ...payload.gameDayNote!, date: next, menuItems: [] } }
      : { ...payload, gameDayNote: null, updates: [], predictionPolls: [] }
  ))
  render(<MemoryRouter initialEntries={[`/today?date=${date}`]}><TodayPage /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Rest day at The Jungle' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Organizer Updates' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Special Events/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Next scheduled night/ }))
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.objectContaining({ date: next }), expect.anything()))
  expect(await screen.findByText('Legacy BBQ')).toBeInTheDocument()
  expect(screen.queryByText('Parking update')).not.toBeInTheDocument()
})

it('shows the rest-day empty state when a published note has no populated fields', async () => {
  vi.spyOn(api, 'publicToday').mockResolvedValue({
    ...payload,
    updates: [],
    predictionPolls: [],
    gameDayNote: {
      id: 'n-empty', tournamentId: '1', date, hostClass: null, foodMenu: null, announcement: null,
      sponsorShoutout: null, active: true, menuItems: [], specialEvents: [], hostSpotlight: {}, photos: [],
    },
  })
  render(<MemoryRouter initialEntries={[`/today?date=${date}`]}><TodayPage /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Rest day at The Jungle' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Next scheduled night/ })).toBeInTheDocument()
})
