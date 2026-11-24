import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../lib/api'
import type { AdminHostCampaign, BudgetLineRecord, FinanceSummary, LedgerEntryRecord, PledgeRecord } from '../../../lib/types'
import { uploadCampaignReceipt } from '../../../lib/uploads'
import { AdminCampaignFinancePage } from '../AdminCampaignFinancePage'

const auth = vi.hoisted(() => ({ user: { id: '2', isSuperAdmin: true } }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuthContext: () => auth }))
vi.mock('../../../lib/uploads', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../lib/uploads')>(),
  uploadCampaignReceipt: vi.fn(),
}))

const campaign = { id: '1', slug: 'class-2017', title: 'Class of 2017', status: 'active' } as AdminHostCampaign
const summary = { budgetVsActual: [], mixedNetEventIds: [], pendingReimbursementsCount: 2 } as unknown as FinanceSummary
const expense = (id: string, reimbursementStatus: LedgerEntryRecord['reimbursementStatus'], recordedById: string) => ({
  id, entryType: 'expense', counterparty: `Vendor ${id}`, amountCents: 1_000, reimbursementStatus, recordedById,
  paidByUserId: recordedById, voided: false, source: 'event_expense', paymentMethod: 'cash',
}) as LedgerEntryRecord
const expenses = [expense('own', 'requested', '2'), expense('waiting', 'requested', '3'), expense('approved', 'approved', '4')]
const options = {
  budgetLines: [{ id: 'income-line', kind: 'income' as const, category: 'Fundraiser net payout' }],
  events: [{ id: '32', title: 'Alumni Golf' }],
  members: [{ id: '2', email: 'treasurer@example.com', fullName: 'Class Treasurer' }],
  pledges: [], sponsors: [],
}

function open(path = '/admin/campaign/finance?campaign=class-2017') {
  return render(<MemoryRouter initialEntries={[path]}><AdminCampaignFinancePage /></MemoryRouter>)
}

beforeEach(() => {
  vi.spyOn(api, 'adminCampaignWorkspace').mockResolvedValue({ campaigns: [campaign] })
  vi.spyOn(api, 'campaignFinanceSummary').mockResolvedValue({ campaign, roles: ['admin'], summary })
  vi.spyOn(api, 'campaignBudgetLines').mockResolvedValue({ budgetLines: [] })
  vi.spyOn(api, 'campaignPledges').mockResolvedValue({ pledges: [], sponsors: [] })
  vi.spyOn(api, 'campaignFinanceAuditEvents').mockResolvedValue({ auditEvents: [] })
  vi.spyOn(api, 'campaignLedgerEntries').mockResolvedValue({ ledgerEntries: expenses, options })
  vi.spyOn(api, 'campaignCreateLedgerEntry').mockResolvedValue({ ledgerEntry: expenses[0] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.mocked(uploadCampaignReceipt).mockReset()
})

describe('finance quick entry', () => {
  it('opens income from an event deep link, explains deposited vs gross, and saves the event and matching budget line', async () => {
    open('/admin/campaign/finance?campaign=class-2017&action=income&eventId=32')
    const dialog = within(await screen.findByRole('dialog', { name: 'Record money received' }))
    expect(dialog.getByText(/gross sales are before fees/i)).toBeInTheDocument()
    expect(dialog.getByText(/what actually arrived after fees/i)).toBeInTheDocument()
    expect(dialog.getByText('Alumni Golf', { selector: 'strong' })).toBeInTheDocument()
    const details = dialog.getByText('More details')
    expect(details.closest('details')).not.toHaveAttribute('open')
    expect(dialog.getByLabelText('Date')).toHaveValue(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Pacific/Guam' }).format(new Date()))
    expect(dialog.getByLabelText('Category')).toHaveValue('fundraiser_net')
    expect(dialog.queryByText('Someone paid out of pocket')).not.toBeInTheDocument()

    const amount = dialog.getByRole('textbox', { name: 'Amount ($)' })
    fireEvent.change(amount, { target: { value: '10.555' } })
    expect(amount).toHaveAttribute('aria-invalid', 'true')
    expect(dialog.getByText(/enter a valid dollar amount/i)).toBeInTheDocument()
    fireEvent.change(amount, { target: { value: '1,250.50' } })
    fireEvent.change(dialog.getByLabelText('Who paid'), { target: { value: 'Golf proceeds' } })
    fireEvent.click(details)
    expect(details.closest('details')).toHaveAttribute('open')
    expect(dialog.getByLabelText('Fundraiser event')).toHaveValue('32')
    fireEvent.change(dialog.getByLabelText('Reference number'), { target: { value: 'Deposit 1' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Record money received' }))

    await waitFor(() => expect(api.campaignCreateLedgerEntry).toHaveBeenCalledWith('class-2017', expect.objectContaining({
      entryType: 'income', amountCents: 125_050, source: 'fundraiser_net', campaignEventId: '32',
      budgetLineId: 'income-line', counterparty: 'Golf proceeds', referenceNumber: 'Deposit 1',
    })))
    expect(await screen.findByText('Money received recorded.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'View finance history →' })).toHaveAttribute('href', '/admin/audit?area=finance')
  })

  it('shows payer details only when needed, uploads a private receipt and requests reimbursement', async () => {
    vi.mocked(uploadCampaignReceipt).mockResolvedValue('private-upload')
    open('/admin/campaign/finance?campaign=class-2017&action=expense&eventId=32')
    const dialog = within(await screen.findByRole('dialog', { name: 'Record expense' }))
    expect(dialog.getByText('Alumni Golf', { selector: 'strong' })).toBeInTheDocument()
    expect(dialog.queryByLabelText('Who paid out of pocket')).not.toBeInTheDocument()
    expect(dialog.getByText(/receipts stay private to authorized officers/i)).toBeInTheDocument()
    fireEvent.click(dialog.getByLabelText('Someone paid out of pocket'))
    fireEvent.change(dialog.getByLabelText('Who paid out of pocket'), { target: { value: '2' } })
    fireEvent.change(dialog.getByRole('textbox', { name: 'Amount ($)' }), { target: { value: '75' } })
    fireEvent.change(dialog.getByLabelText('Who received money'), { target: { value: 'Event vendor' } })
    const file = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' })
    fireEvent.change(dialog.getByLabelText('Upload or take photo of receipt'), { target: { files: [file] } })
    expect(await dialog.findByText('Receipt ready: receipt.pdf')).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Record expense' }))
    await waitFor(() => expect(api.campaignCreateLedgerEntry).toHaveBeenCalledWith('class-2017', expect.objectContaining({
      entryType: 'expense', reimbursementStatus: 'requested', paidByUserId: '2',
      campaignEventId: '32', receiptUploadToken: 'private-upload',
    })))
    expect(uploadCampaignReceipt).toHaveBeenCalledWith({ file, campaignSlug: 'class-2017' })
  })

  it('uses the quick bar to switch to reimbursements and shows the next officer action', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Record expense' }))
    expect(await screen.findByRole('dialog', { name: 'Record expense' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reimbursements to review (2)' }))
    expect(screen.getByRole('heading', { name: /Reimbursement approval queue/ })).toBeInTheDocument()
    expect(screen.getByText(/awaiting approval from another chair or treasurer/i)).toBeInTheDocument()
    expect(screen.getByText('Ready to approve.')).toBeInTheDocument()
    expect(screen.getByText('Approved — ready for treasurer payout.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    const progress = screen.getAllByRole('list', { name: 'Reimbursement progress' })
    expect(within(progress[2]).getByText('Approved').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(within(progress[2]).getByText('Paid')).toBeInTheDocument()
  })

  it('keeps archived campaigns read-only even with an action in the URL', async () => {
    vi.mocked(api.campaignFinanceSummary).mockResolvedValue({ campaign: { ...campaign, status: 'archived' }, roles: ['admin'], summary })
    open('/admin/campaign/finance?campaign=class-2017&action=income&eventId=32')
    expect(await screen.findByText('Archived campaign (read-only)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record money received' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not open a different ledger when a deep-linked campaign is inaccessible', async () => {
    open('/admin/campaign/finance?campaign=class-of-2018&action=income')
    expect(await screen.findByText('Finance access unavailable')).toBeInTheDocument()
    expect(api.campaignFinanceSummary).not.toHaveBeenCalled()
  })
})

it('uses the ledger for old audit links and skips the legacy audit request', async () => {
  open('/admin/campaign/finance?tab=audit')
  expect(await screen.findByRole('button', { name: /^Ledger/ })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByRole('button', { name: /Audit log/i })).not.toBeInTheDocument()
  expect(api.campaignFinanceAuditEvents).not.toHaveBeenCalled()
})

it('opens budget creation and editing on demand', async () => {
  const line: BudgetLineRecord = {
    id: 'venue', hostCampaignId: campaign.id, kind: 'expense', category: 'Venue',
    budgetCents: 100_000, position: 0, notes: null, archivedAt: null,
  }
  const create = vi.spyOn(api, 'campaignCreateBudgetLine').mockImplementation(async () => {
    vi.mocked(api.campaignBudgetLines).mockResolvedValue({ budgetLines: [line] })
    vi.mocked(api.campaignFinanceSummary).mockResolvedValue({
      campaign, roles: ['admin'], summary: { ...summary, budgetVsActual: [{ ...line, actualCents: 0, varianceCents: -100_000, archived: false }] },
    })
    return { budgetLine: line }
  })
  const update = vi.spyOn(api, 'campaignUpdateBudgetLine').mockResolvedValue({ budgetLine: line })

  open('/admin/campaign/finance?tab=budget')
  const add = await screen.findByRole('button', { name: 'Add budget line' })
  expect(screen.queryByLabelText('Planned budget (USD)')).not.toBeInTheDocument()
  fireEvent.click(add)
  const dialog = within(screen.getByRole('dialog', { name: 'Add budget line' }))
  fireEvent.change(dialog.getByLabelText('Category'), { target: { value: 'Venue' } })
  fireEvent.change(dialog.getByLabelText('Planned budget (USD)'), { target: { value: '1000' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Save budget line' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(create).toHaveBeenCalledWith(campaign.slug, expect.objectContaining({ category: 'Venue', budgetCents: 100_000 }))

  fireEvent.click(screen.getByRole('button', { name: 'Edit budget line' }))
  const edit = within(screen.getByRole('dialog', { name: 'Edit budget line' }))
  expect(edit.getByLabelText('Planned budget (USD)')).toHaveValue('1000')
  fireEvent.change(edit.getByLabelText('Planned budget (USD)'), { target: { value: '1500' } })
  fireEvent.click(edit.getByRole('button', { name: 'Save budget line' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(update).toHaveBeenCalledWith(campaign.slug, line.id, expect.objectContaining({ budgetCents: 150_000 }))
})

it('opens pledge creation and editing on demand', async () => {
  const pledge: PledgeRecord = {
    id: 'sponsor', hostCampaignId: campaign.id, donorName: 'Community Sponsor', sponsorId: null,
    sponsorName: null, contactInfo: null, tier: 'Gold', isInKind: false, promisedCents: 25_000, receivedCents: 0,
    outstandingCents: 25_000, overpaymentCents: 0, dueOn: null, status: 'promised', notes: null,
    recordedById: '2', recordedByName: null,
  }
  const create = vi.spyOn(api, 'campaignCreatePledge').mockImplementation(async () => {
    vi.mocked(api.campaignPledges).mockResolvedValue({ pledges: [pledge], sponsors: [] })
    return { pledge }
  })
  const update = vi.spyOn(api, 'campaignUpdatePledge').mockResolvedValue({ pledge })

  open('/admin/campaign/finance?tab=pledges')
  const add = await screen.findByRole('button', { name: 'Add pledge' })
  expect(screen.queryByLabelText('Donor / Sponsor name')).not.toBeInTheDocument()
  fireEvent.click(add)
  const dialog = within(screen.getByRole('dialog', { name: 'Add pledge' }))
  fireEvent.change(dialog.getByLabelText('Donor / Sponsor name'), { target: { value: pledge.donorName } })
  fireEvent.change(dialog.getByLabelText('Promised amount / value (USD)'), { target: { value: '250' } })
  fireEvent.click(dialog.getByRole('button', { name: 'Save pledge' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(create).toHaveBeenCalledWith(campaign.slug, expect.objectContaining({ donorName: pledge.donorName, promisedCents: 25_000 }))

  fireEvent.click(screen.getByRole('button', { name: 'Edit pledge' }))
  const edit = within(screen.getByRole('dialog', { name: 'Edit pledge' }))
  expect(edit.getByLabelText('Donor / Sponsor name')).toHaveValue(pledge.donorName)
  fireEvent.change(edit.getByLabelText('Notes'), { target: { value: 'Confirmed by phone' } })
  fireEvent.click(edit.getByRole('button', { name: 'Save pledge' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(update).toHaveBeenCalledWith(campaign.slug, pledge.id, expect.objectContaining({ notes: 'Confirmed by phone' }))
})
