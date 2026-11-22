import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../../lib/api'
import type { AdminCampaignEvent, AdminHostCampaign, CampaignCloneResponse, CampaignHandoffStatus, HandoffOfficer, TournamentChampion } from '../../../lib/types'
import { AdminCampaignHostYearPage } from '../AdminCampaignHostYearPage'
import { TournamentChampionsPanel } from './TournamentChampionsPanel'

vi.mock('../../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { id: '5', isSuperAdmin: true } }) }))

const outgoing = {
  id: '7', slug: 'class-of-2017', title: 'Class of 2017 Host Year', status: 'closing', tournamentId: '10',
  tournament: { id: '10', year: 2027 }, hostClass: { graduationYear: 2017 }, goalCents: 3_000_000,
  fdaaUpfrontCents: 1_500_000, fdaaTicketShareBps: 5_000, featured: true,
} as AdminHostCampaign
const incoming = {
  ...outgoing, id: '8', slug: '2028-class-of-2018', title: 'Class of 2018 Host Year', status: 'draft', tournamentId: '11',
  tournament: { id: '11', year: 2028 }, hostClass: { graduationYear: 2018 }, featured: false,
} as AdminHostCampaign
const officers: HandoffOfficer[] = [
  { role: 'chair', invited: false, accepted: false, invitations: [], members: [], pendingActions: { fundraisers_and_sponsors: ['view', 'publish'] } },
  { role: 'treasurer', invited: false, accepted: false, invitations: [], members: [], pendingActions: { finance_and_reimbursements: ['record', 'payout'] } },
]
const onboarding: CampaignHandoffStatus['onboarding'] = {
  fundingAssumptionsPresent: true, publicCopyConfigured: false, goalConfigured: true, ticketLinksSet: false,
  donationLinkSet: false, firstFundraiserCreated: true, firstFundraiserScheduled: false, published: false, featured: false, officers,
}
const closeout: CampaignHandoffStatus['closeout'] = {
  campaignId: '7', status: 'closing', unfinalizedGamesCount: 1, pendingReimbursementsCount: 2, openCashPledgesCount: 1,
  missingReceiptsCount: 1, championsRecordedCount: 0, liveExpensesCount: 2, voidedEntriesCount: 0, auditEventsCount: 4,
  blockers: [{ code: 'pending_reimbursements', count: 2, message: 'Two pending' }], warnings: [],
  ready: false, boardReportReady: false, checklist: [
    { code: 'unfinalized_games', complete: false, severity: 'blocker', count: 1 },
    { code: 'pending_reimbursements', complete: false, severity: 'blocker', count: 2 },
    { code: 'missing_receipts', complete: false, severity: 'warning', count: 1 },
    { code: 'open_cash_pledges', complete: false, severity: 'warning', count: 1 },
    { code: 'champions_confirmed', complete: false, severity: 'warning', count: 0 },
    { code: 'board_report_ready', complete: false, severity: 'step', count: null },
    { code: 'archive', complete: false, severity: 'step', count: null },
  ],
}
const event = { id: '121', kind: 'fundraiser', status: 'open', title: 'Alumni social', publicVisible: true } as AdminCampaignEvent

function response(campaign: AdminHostCampaign, options: Partial<CampaignHandoffStatus> = {}): CampaignHandoffStatus {
  return {
    campaign: { ...campaign, tournamentYear: campaign.tournament!.year, hostClassYear: campaign.hostClass!.graduationYear },
    closeout, onboarding: campaign.id === incoming.id ? onboarding : null,
    canPrepareNextYear: true, relatedNextCampaign: null, ...options,
  }
}

function open(slug: string, tab: string) {
  render(<MemoryRouter initialEntries={[`/admin/campaign/host-year?campaign=${slug}&tab=${tab}`]}>
    <AdminCampaignHostYearPage />
  </MemoryRouter>)
}

beforeEach(() => {
  vi.spyOn(api, 'adminCampaignWorkspace').mockResolvedValue({ campaigns: [outgoing, incoming] })
  vi.spyOn(api, 'adminCampaigns').mockResolvedValue({ campaigns: [outgoing] })
  vi.spyOn(api, 'adminTournaments').mockResolvedValue({ tournaments: [] })
  vi.spyOn(api, 'campaignSettings').mockImplementation(async (slug) => ({ campaign: slug === incoming.slug ? incoming : outgoing, roles: ['admin'] }))
  vi.spyOn(api, 'campaignEvents').mockResolvedValue({ events: [event] })
  vi.spyOn(api, 'campaignPosts').mockResolvedValue({ posts: [] })
  vi.spyOn(api, 'adminCampaignHandoffStatus').mockImplementation(async (id) => response(id === incoming.id ? incoming : outgoing))
  vi.spyOn(api, 'adminTournamentChampions').mockResolvedValue({ champions: [] })
  vi.spyOn(api, 'adminChampionTeamOptions').mockResolvedValue({ teams: ['Class of 2017', 'Class of 2018'] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('shows closeout blockers, warnings, actions and archive override validation', async () => {
  const archive = vi.spyOn(api, 'adminArchiveCampaign').mockResolvedValue({
    campaign: { ...outgoing, status: 'archived' }, tournament: outgoing.tournament, closeoutCheck: closeout,
  })
  open(outgoing.slug, 'handoff')
  const checklist = within(await screen.findByRole('list', { name: 'Outgoing closeout checklist' }))
  expect(checklist.getAllByText('Blocks archive')).toHaveLength(2)
  expect(checklist.getAllByText('Warning')).toHaveLength(3)
  expect(checklist.getByRole('link', { name: 'Review unresolved games' })).toHaveAttribute('href', '/admin/scorekeeper?tournamentId=10&view=missing')
  expect(checklist.getByRole('link', { name: 'Review pending reimbursements' })).toHaveAttribute('href', '/admin/finance?campaign=class-of-2017&tab=reimbursements')
  expect(checklist.getByRole('link', { name: 'Open board report' })).toHaveAttribute('href', '/admin/finance?campaign=class-of-2017&tab=report')
  fireEvent.click(screen.getByRole('button', { name: 'Archive campaign' }))
  const reason = screen.getByLabelText('Audited override reason')
  expect(reason).toBeRequired()
  fireEvent.change(reason, { target: { value: 'Board approved the exceptions' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }))
  await waitFor(() => expect(archive).toHaveBeenCalledWith('7', { completeTournament: true, forceReason: 'Board approved the exceptions' }))
})

it('reviews carry-forward, creates a private draft and invites officers to the incoming workspace', async () => {
  const clone = vi.spyOn(api, 'adminCloneCampaign').mockResolvedValue({ campaign: incoming } as CampaignCloneResponse)
  const invite = vi.spyOn(api, 'adminCreateCampaignInvitation').mockImplementation(async (_id, payload) => {
    vi.mocked(api.adminCampaignHandoffStatus).mockImplementation(async (id) => id === incoming.id
      ? response(incoming, { onboarding: { ...onboarding, officers: [
        { ...officers[0], invited: true, invitations: [{ email: payload.email, status: 'pending' }] }, officers[1],
      ] } })
      : response(outgoing))
    return { invitation: { id: '70', email: payload.email, role: payload.role, status: 'pending' } } as Awaited<ReturnType<typeof api.adminCreateCampaignInvitation>>
  })

  open(outgoing.slug, 'settings')
  fireEvent.click(await screen.findByRole('button', { name: 'Prepare Class of 2018' }))
  expect(await screen.findByText(/outgoing ledger, receipts, pledges, HåfaPass links, and credentials/i)).toBeInTheDocument()
  expect(screen.getByText(/\$15,000.00 upfront and 50%/)).toBeInTheDocument()
  expect(screen.getByLabelText('Host class graduation year')).toHaveValue(2018)
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2028-06-23' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2028-07-14' } })
  fireEvent.click(screen.getByLabelText('Carry forward private event templates with dates TBD'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Review private draft' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Review private draft' }))
  expect(clone).not.toHaveBeenCalled()
  expect(screen.getByText('Create private draft', { selector: 'li' })).toHaveAttribute('aria-current', 'step')
  fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }))
  await screen.findByRole('heading', { name: 'Class of 2018 Host Year draft created' })
  expect(clone).toHaveBeenCalledWith('7', expect.objectContaining({
    hostClassYear: 2018, tournament: expect.objectContaining({ year: 2028 }),
    copyDivisions: true, copyBudgetCategories: true, copyBudgetAmounts: false, copyEventTemplates: false,
  }))
  fireEvent.change(screen.getByLabelText('Officer email'), { target: { value: 'chair@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Invite officer' }))
  expect(await screen.findByText('chair@example.com · Pending verified sign-in')).toBeInTheDocument()
  expect(invite).toHaveBeenCalledWith('8', { email: 'chair@example.com', role: 'chair' })
  expect(screen.getByText(/Finance · Record entries, Mark reimbursements paid/)).toBeInTheDocument()

  fireEvent.click(await screen.findByRole('link', { name: 'Open incoming year workspace' }))
  expect(await screen.findByRole('list', { name: 'Incoming onboarding checklist' })).toBeInTheDocument()
  expect(screen.getByText(/Publishing the incoming fundraiser is independent/)).toBeInTheDocument()
  expect(screen.getByText('Schedule the first fundraiser')).toBeInTheDocument()

  const update = vi.spyOn(api, 'adminUpdateCampaign').mockImplementation(async () => {
    const active = { ...incoming, status: 'active' as const }
    vi.mocked(api.adminCampaignHandoffStatus).mockResolvedValue(response(active, { onboarding: { ...onboarding, published: true } }))
    return { campaign: active }
  })
  fireEvent.click(screen.getByText('Preview fundraiser page'))
  fireEvent.click(screen.getByRole('button', { name: 'Publish fundraiser page' }))
  expect(await screen.findByRole('link', { name: 'View public fundraiser page' })).toHaveAttribute('href', '/host-year/2028-class-of-2018')
  expect(update).toHaveBeenCalledWith('8', { status: 'active' })
})

it('links event cards to the finance form for the same campaign and event', async () => {
  open(outgoing.slug, 'events')
  expect(await screen.findByRole('link', { name: 'Record money from this event' }))
    .toHaveAttribute('href', '/admin/finance?campaign=class-of-2017&action=income&eventId=121')
})

it('confirms, edits and removes champions and provides a scoped recap preview link', async () => {
  const record = { id: '40', bracket: 'maroon', championLabel: 'Class of 2017', runnerUpLabel: 'Class of 2018', status: 'completed' } as TournamentChampion
  const create = vi.spyOn(api, 'adminCreateTournamentChampion').mockImplementation(async () => {
    vi.mocked(api.adminTournamentChampions).mockResolvedValue({ champions: [record] })
    return { champion: record }
  })
  const update = vi.spyOn(api, 'adminUpdateTournamentChampion').mockResolvedValue({ champion: record })
  const remove = vi.spyOn(api, 'adminDeleteTournamentChampion').mockImplementation(async () => {
    vi.mocked(api.adminTournamentChampions).mockResolvedValue({ champions: [] })
  })
  open(outgoing.slug, 'handoff')
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm a division champion' }))
  fireEvent.change(screen.getByLabelText('Bracket'), { target: { value: 'maroon' } })
  fireEvent.change(screen.getByLabelText('Champion'), { target: { value: 'Class of 2017' } })
  fireEvent.change(screen.getByLabelText('Runner-up'), { target: { value: 'Class of 2018' } })
  fireEvent.change(screen.getByLabelText('Score'), { target: { value: '75–68' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save champion' }))
  expect(await screen.findByRole('link', { name: 'Publish tournament recap' })).toHaveAttribute('href', '/admin/site-mode?mode=tournament_recap&tournamentId=10')
  expect(create).toHaveBeenCalledWith('10', expect.objectContaining({ bracket: 'maroon', score: '75–68', championLabel: 'Class of 2017' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Maroon champion' }))
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Board reviewed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save champion' }))
  await waitFor(() => expect(update).toHaveBeenCalledWith('10', '40', expect.objectContaining({ notes: 'Board reviewed' })))
  fireEvent.click(await screen.findByRole('button', { name: 'Remove Maroon champion' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm removal' }))
  expect(await screen.findByText('Champion removed.')).toBeInTheDocument()
  expect(remove).toHaveBeenCalledWith('10', '40')
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Publish tournament recap' })).not.toBeInTheDocument())
})

it('presents a read-only champions panel without the Site Mode publishing capability', async () => {
  vi.mocked(api.adminTournamentChampions).mockResolvedValue({
    champions: [{ id: '40', bracket: 'overall', championLabel: 'Class of 2017', status: 'completed' } as TournamentChampion],
  })
  render(<MemoryRouter><TournamentChampionsPanel tournamentId="10" canView canConfirm={false} canPublishRecap={false} onChanged={async () => {}} /></MemoryRouter>)
  expect(await screen.findByText('Class of 2017')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /champion/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Publish tournament recap' })).not.toBeInTheDocument()
  expect(api.adminChampionTeamOptions).not.toHaveBeenCalled()
})
