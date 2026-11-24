import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { offlineSiteMode } from '../../lib/siteMode'
import type { CurrentUser, EffectiveCapability, FinanceSummary } from '../../lib/types'
import { adminCampaign } from '../../test/fundraiserFixtures'
import { AdminOverviewPage } from './AdminOverviewPage'

const auth = vi.hoisted(() => ({ user: null as CurrentUser | null }))
vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => auth }))
vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  api: { adminCampaignWorkspace: vi.fn(), campaignFinanceSummary: vi.fn(), campaignSettings: vi.fn(), adminDashboard: vi.fn(), publicSiteMode: vi.fn() },
}))

const capability = (name: string, actions = ['view']): EffectiveCapability => ({
  capability: name, actions, scopeType: 'campaign', scopeIds: [adminCampaign.id], allScopes: false,
})

function open(...capabilities: EffectiveCapability[]) {
  auth.user = {
    id: '1', fullName: 'Test Organizer', firstName: 'Test', lastName: 'Organizer', email: 'organizer@example.test',
    clerkId: null, role: 'staff', active: true, isAdmin: false, isStaff: false, capabilities,
  }
  render(<MemoryRouter><AdminOverviewPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.adminCampaignWorkspace).mockResolvedValue({ campaigns: [adminCampaign] })
  vi.mocked(api.campaignSettings).mockResolvedValue({ campaign: adminCampaign, roles: [] })
  vi.mocked(api.publicSiteMode).mockResolvedValue({ siteMode: offlineSiteMode, alerts: [] })
})

it('shows private totals and shortcuts for the authorized active campaign only', async () => {
  const summary = { raisedCents: 420_000, goalCents: 3_000_000, pendingReimbursementsCount: 2 } as FinanceSummary
  vi.mocked(api.adminCampaignWorkspace).mockResolvedValue({
    campaigns: [{ ...adminCampaign, id: 'unauthorized', slug: 'other' }, adminCampaign],
  })
  vi.mocked(api.campaignFinanceSummary).mockResolvedValue({ campaign: adminCampaign, summary, roles: ['treasurer'] })
  open(capability('finance_and_reimbursements', ['view', 'record']))
  expect(screen.getByRole('heading', { name: 'Welcome, Test' })).toBeInTheDocument()
  expect(await screen.findByText('$4,200.00')).toBeInTheDocument()
  expect(screen.getByText('/ $30,000.00')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Record money' })).toHaveAttribute('href', '/admin/campaign/finance?campaign=alumni-host-year&action=income')
  expect(api.campaignFinanceSummary).toHaveBeenCalledExactlyOnceWith(adminCampaign.slug)
  expect(api.adminDashboard).not.toHaveBeenCalled()
  expect(api.publicSiteMode).not.toHaveBeenCalled()
})

it('offers events and site mode for authorized users without fetching private finance totals', async () => {
  open(capability('fundraisers_and_sponsors'), { ...capability('site_mode_and_settings'), allScopes: true })
  expect(await screen.findByRole('link', { name: 'Manage fundraisers' })).toHaveAttribute('href', expect.stringContaining('tab=events'))
  expect(await screen.findByText('$4,200.00')).toBeInTheDocument()
  expect(await screen.findByText('Fundraising')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Change site mode' })).toHaveAttribute('href', '/admin/site-mode')
  expect(api.campaignFinanceSummary).not.toHaveBeenCalled()
})

it('keeps the workspace accessible when campaign data fails', async () => {
  vi.mocked(api.campaignFinanceSummary).mockRejectedValue(new Error('Unavailable'))
  open(capability('finance_and_reimbursements'))
  await waitFor(() => expect(screen.getByText('Campaign totals are unavailable.')).toBeInTheDocument())
  expect(screen.queryByRole('link', { name: 'Record money' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open finance workspace' })).toBeInTheDocument()
})

it('only offers the results workspace for a scorekeeper', () => {
  open(capability('scores_and_stats'))
  expect(screen.getByRole('link', { name: /Results & Standings/ })).toBeInTheDocument()
  expect(api.adminCampaignWorkspace).not.toHaveBeenCalled()
  expect(api.publicSiteMode).not.toHaveBeenCalled()
  expect(api.adminDashboard).not.toHaveBeenCalled()
})
