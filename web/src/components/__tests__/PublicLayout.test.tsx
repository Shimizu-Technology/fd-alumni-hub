import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { offlineSiteMode } from '../../lib/siteMode'
import { NotFoundPage } from '../../pages/public/NotFoundPage'
import { PublicLayout } from '../PublicLayout'
import * as backendHook from '../../hooks/useBackendAvailability'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PublicLayout', () => {
  it('renders offline status banner with Retry button when API is unavailable', () => {
    const retry = vi.fn(async () => {})
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'unavailable',
      isUnavailable: true,
      isChecking: false,
      retry,
      reportUnavailable: vi.fn(),
      reportAvailable: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<div>Home Body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Live tournament services are currently paused or unreachable/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retry connection/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('opens and closes the mobile site menu drawer via More button and Escape', () => {
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available',
      isUnavailable: false,
      isChecking: false,
      retry: vi.fn(async () => {}),
      reportUnavailable: vi.fn(),
      reportAvailable: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<div>Home Body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const moreBtn = screen.getByRole('button', { name: /Open more menu/i })
    fireEvent.click(moreBtn)
    expect(screen.getByRole('dialog', { name: /Site menu/i })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Site menu/i })).not.toBeInTheDocument()
  })
})

describe('seasonal navigation', () => {
  const modes = [
    ['fundraising', ['Home', 'History', 'Gallery', 'Sponsors', 'Info'], ['Home', 'History', 'Sponsors']],
    ['schedule_ready', ['Home', 'Schedule', 'Teams', 'Tickets', 'Bracket', 'History'], ['Home', 'Schedule', 'Tickets']],
    ['tournament_live', ['Tonight', 'Schedule', 'Standings', 'Bracket', 'Tickets', 'History'], ['Tonight', 'Schedule', 'Tickets']],
    ['tournament_recap', ['Recap', 'History', 'Fundraisers'], ['Recap', 'History']],
  ] as const

  it('refreshes seasonal navigation on a page that stays open', async () => {
    vi.useFakeTimers()
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available', isUnavailable: false, isChecking: false,
      retry: vi.fn(async () => {}), reportUnavailable: vi.fn(), reportAvailable: vi.fn(),
    })
    vi.spyOn(api, 'publicSiteMode')
      .mockResolvedValueOnce({ siteMode: offlineSiteMode, alerts: [] })
      .mockResolvedValue({ siteMode: {
        ...offlineSiteMode, mode: 'tournament_live', navItems: [{ label: 'Tonight', to: '/today' }],
      }, alerts: [] })
    render(<MemoryRouter initialEntries={['/schedule']}>
      <Routes><Route element={<PublicLayout />}><Route path="*" element={<div>Schedule content</div>} /></Route></Routes>
    </MemoryRouter>)
    await act(async () => {})
    const primary = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    expect(primary.queryByRole('link', { name: 'Tonight' })).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000) })
    expect(primary.getByRole('link', { name: 'Tonight' })).toHaveAttribute('href', '/today')
    expect(screen.getByText('Schedule content')).toBeInTheDocument()
  })

  it.each(modes)('renders %s navigation and keeps urgent warnings and the 404 visible', async (mode, desktop, bottom) => {
    const paths: Record<string, string> = { Home: '/', Fundraisers: '/host-year', Tonight: '/today', Recap: '/history/2090' }
    const link = (label: string) => ({ label, to: paths[label] || `/${label.toLowerCase()}` })
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available', isUnavailable: false, isChecking: false,
      retry: vi.fn(async () => {}), reportUnavailable: vi.fn(), reportAvailable: vi.fn(),
    })
    vi.spyOn(api, 'publicSiteMode').mockResolvedValue({
      siteMode: { ...offlineSiteMode, mode, navItems: desktop.map(link), mobileBottomNav: [...bottom.map(link), { label: 'More', to: null }] },
      alerts: [{
        id: '1', severity: 'urgent', title: 'Storm warning', message: 'Check road conditions.',
        active: true, tournamentId: null, startsAt: null, expiresAt: null,
      }],
    })
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <Routes><Route element={<PublicLayout />}><Route path="*" element={<NotFoundPage />} /></Route></Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Storm warning')
    const primary = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    expect(primary.getAllByRole('link').map((entry) => entry.textContent)).toEqual(desktop)
    const mobile = within(screen.getByRole('navigation', { name: 'Mobile quick navigation' }))
    expect(mobile.getAllByRole('link').map((entry) => entry.textContent)).toEqual(bottom)
    expect(mobile.getByRole('button', { name: 'Open more menu' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Organizer sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /GuamTime/i })).not.toBeInTheDocument()
  })

  it('hides inactive off-season links from the mobile drawer and footer in fundraising mode', async () => {
    vi.spyOn(backendHook, 'useBackendAvailabilityContext').mockReturnValue({
      status: 'available', isUnavailable: false, isChecking: false,
      retry: vi.fn(async () => {}), reportUnavailable: vi.fn(), reportAvailable: vi.fn(),
    })
    vi.spyOn(api, 'publicSiteMode').mockResolvedValue({
      siteMode: offlineSiteMode,
      alerts: [],
    })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes><Route element={<PublicLayout />}><Route index element={<div>Home</div>} /></Route></Routes>
      </MemoryRouter>,
    )
    await act(async () => {})
    const footerNav = within(screen.getByRole('navigation', { name: 'More tournament pages' }))
    expect(footerNav.getByRole('link', { name: 'News' })).toBeInTheDocument()
    expect(footerNav.queryByRole('link', { name: 'Schedule' })).not.toBeInTheDocument()
    expect(footerNav.queryByRole('link', { name: 'Bracket' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Open more menu/i }))
    const drawer = within(screen.getByRole('dialog', { name: /Site menu/i }))
    expect(drawer.getByRole('link', { name: 'History' })).toBeInTheDocument()
    expect(drawer.getByRole('link', { name: 'Sponsors' })).toBeInTheDocument()
    expect(drawer.queryByRole('link', { name: 'Schedule' })).not.toBeInTheDocument()
    expect(drawer.queryByRole('link', { name: 'Standings' })).not.toBeInTheDocument()
    expect(drawer.queryByRole('link', { name: 'Fundraisers' })).not.toBeInTheDocument()
  })
})
