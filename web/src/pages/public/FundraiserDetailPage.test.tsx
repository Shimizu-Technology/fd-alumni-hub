import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api, ApiError } from '../../lib/api'
import { offlineSiteMode, type SiteModeName } from '../../lib/siteMode'
import { campaign, completedEvent, hafapass, upcomingEvent } from '../../test/fundraiserFixtures'
import { FundraiserDetailPage } from './FundraiserDetailPage'

const mode = vi.hoisted(() => ({ value: 'fundraising' as SiteModeName }))
vi.mock('../../contexts/SiteModeContext', () => ({
  useSiteMode: () => ({ siteMode: { ...offlineSiteMode, mode: mode.value } }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  mode.value = 'fundraising'
})

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/fundraisers/:id" element={<FundraiserDetailPage />} />
    <Route path="/host-year/events/:id" element={<FundraiserDetailPage />} />
  </Routes></MemoryRouter>)
}

it('shows the full flyer and live purchase link on the alternate detail route', async () => {
  mode.value = 'schedule_ready'
  const load = vi.spyOn(api, 'publicFundraiser').mockResolvedValue({ event: upcomingEvent, campaign, hafapass })
  open('/host-year/events/20')
  expect(await screen.findByRole('heading', { name: 'Alumni dinner' })).toBeInTheDocument()
  expect(load).toHaveBeenCalledWith('20')
  expect(screen.getByRole('img', { name: 'Flyer for Alumni dinner' })).toHaveAttribute('src', upcomingEvent.imageUrl)
  expect(screen.getByText('Tickets on sale')).toBeInTheDocument()
  expect(screen.getByText('Main hall', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Dinner with the host class.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Buy tickets' })).toHaveAttribute('href', 'https://example.com/tickets')
  expect(screen.getByRole('link', { name: /Back to fundraisers/ })).toHaveAttribute('href', '/host-year')
  expect(screen.queryByRole('heading', { name: 'Event Recap' })).toBeNull()
})

it('shows a completed recap and restores photo focus after keyboard and click navigation', async () => {
  // jsdom supports the closed dialog element. Supply browser open/close behavior for this unit test.
  const dialogPrototype = HTMLDialogElement.prototype
  const showModal = dialogPrototype.showModal
  const close = dialogPrototype.close
  if (!showModal) dialogPrototype.showModal = function () { this.setAttribute('open', '') }
  if (!close) dialogPrototype.close = function () { this.removeAttribute('open') }

  try {
    vi.spyOn(api, 'publicFundraiser').mockResolvedValue({ event: completedEvent, campaign, hafapass })
    open('/fundraisers/21')
    expect(await screen.findByRole('heading', { name: 'Event Recap' })).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('$4,200 raised')).toBeInTheDocument()
    expect(screen.getByText('Thank you for supporting the court.')).toBeInTheDocument()
    expect(screen.getByText('Alumni scrimmage.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Buy tickets' })).toBeNull()
    expect(screen.getByRole('link', { name: /Back to fundraisers/ })).toHaveAttribute('href', '/')

    const thumbnail = screen.getByRole('button', { name: /Open recap photo 1/ })
    fireEvent.click(thumbnail)
    const dialog = screen.getByRole('dialog', { name: 'Recap Photo Gallery' })
    const modal = within(dialog)
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(modal.getByRole('button', { name: 'Close' })).toHaveFocus()
    expect(modal.getByText('The team')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(modal.getByText('First tip-off')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(modal.getByText('The team')).toBeInTheDocument()
    fireEvent.click(modal.getByRole('button', { name: 'Next' }))
    expect(modal.getByText('First tip-off')).toBeInTheDocument()
    fireEvent.click(modal.getByRole('button', { name: 'Previous' }))
    expect(modal.getByText('The team')).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(thumbnail).toHaveFocus()
  } finally {
    if (!showModal) Reflect.deleteProperty(dialogPrototype, 'showModal')
    if (!close) Reflect.deleteProperty(dialogPrototype, 'close')
  }
})

it('handles an unavailable fundraiser', async () => {
  vi.spyOn(api, 'publicFundraiser').mockRejectedValue(new ApiError('Fundraiser not found', 404, {}))
  open('/fundraisers/unknown')
  expect(await screen.findByRole('heading', { name: 'Fundraiser not found' })).toBeInTheDocument()
})
