import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { offlineSiteMode, type SiteModeAdmin, type SitePublication } from '../../lib/siteMode'
import { AdminSiteModePage } from './AdminSiteModePage'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const current: SitePublication = {
  id: '1', versionNumber: 1, mode: 'fundraising', tournamentId: '10', hostCampaignId: null,
  sectionOverrides: {}, recapHeadline: null, recapSummary: null, handoffBannerEnabled: false,
  publishedAt: '2026-11-23T08:00:00Z', publishedByName: 'Alumni Organizer', restoredFromId: null,
}
const configuration: SiteModeAdmin = {
  current, siteMode: { ...offlineSiteMode, versionNumber: 1, publishedAt: current.publishedAt, publishedByName: current.publishedByName },
  history: [current], campaigns: [], readiness: offlineSiteMode.readiness,
  tournaments: [{ id: '10', year: 2090, name: 'Alumni Tournament', startDate: '2090-07-01', endDate: '2090-07-20', status: 'upcoming', gameCount: 2, schedulePublished: false }],
  suggestedMode: 'schedule_ready', actions: ['publish', 'restore'],
}

function mockRequests(actions = configuration.actions) {
  const load = vi.spyOn(api, 'adminSiteMode').mockResolvedValue({ ...configuration, actions })
  const preview = vi.spyOn(api, 'previewSiteMode').mockImplementation(async (settings) => ({
    previewSiteMode: { ...offlineSiteMode, mode: settings.mode, schedulePublished: settings.publishSchedule, isPreview: true },
    changes: { appearing: settings.publishSchedule ? ['schedule'] : [], disappearing: [] },
    warnings: ['Choose an active host campaign.'],
  }))
  const publish = vi.spyOn(api, 'publishSiteMode').mockResolvedValue({})
  const restore = vi.spyOn(api, 'restoreSiteMode').mockResolvedValue({})
  return { load, preview, publish, restore }
}

it('previews draft changes, publishes the schedule, and restores a prior version', async () => {
  const { load, preview, publish, restore } = mockRequests()
  render(<MemoryRouter><AdminSiteModePage /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('button', { name: /Schedule Ready/ }))
  fireEvent.click(screen.getByLabelText('Publish schedule with this update'))
  expect(await screen.findByText('Show Schedule')).toBeInTheDocument()
  expect(screen.getByText('Choose an active host campaign.')).toBeInTheDocument()
  expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'schedule_ready', tournamentId: '10', publishSchedule: true }), expect.any(AbortSignal))
  fireEvent.click(screen.getByRole('button', { name: 'Desktop' }))
  expect(screen.getByRole('button', { name: 'Desktop' })).toHaveAttribute('aria-pressed', 'true')

  fireEvent.click(screen.getByRole('button', { name: 'Publish change' }))
  await waitFor(() => expect(publish).toHaveBeenCalledWith(expect.objectContaining({ mode: 'schedule_ready', publishSchedule: true })))
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Restore version 1' }))
  await waitFor(() => expect(restore).toHaveBeenCalledWith('1'))
  await waitFor(() => expect(load).toHaveBeenCalledTimes(3))
})

it('lets a view-only organizer preview without publishing or restoring', async () => {
  mockRequests([])
  render(<MemoryRouter><AdminSiteModePage /></MemoryRouter>)
  await screen.findByText('Choose an active host campaign.')
  expect(screen.getByRole('button', { name: 'Publish change' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Restore version 1' })).toBeDisabled()
})

it('opens the linked season as a recap draft without publishing', async () => {
  const { preview, publish } = mockRequests()
  render(<MemoryRouter initialEntries={['/admin/site-mode?mode=tournament_recap&tournamentId=10']}><AdminSiteModePage /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: /Tournament Recap/i })).toHaveAttribute('aria-pressed', 'true')
  await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({
    mode: 'tournament_recap', tournamentId: '10', publishSchedule: false,
  }), expect.any(AbortSignal)))
  expect(publish).not.toHaveBeenCalled()
})
