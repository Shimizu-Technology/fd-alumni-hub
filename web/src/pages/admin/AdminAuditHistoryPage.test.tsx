import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { AdminAuditResponse } from '../../lib/types'
import { AdminAuditHistoryPage } from './AdminAuditHistoryPage'

vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { isSuperAdmin: true } }) }))

vi.mock('../../lib/api', () => ({ api: { adminAuditEvents: vi.fn(), adminAuditExport: vi.fn() } }))

const firstPage: AdminAuditResponse = {
  auditEvents: [{
    id: '1',
    occurredAt: '2027-07-01T08:00:00Z',
    operationId: 'operation-1',
    actorType: 'user',
    actorId: '1',
    actorName: 'Ari Admin',
    actorEmail: 'ari@example.test',
    actorRole: 'admin',
    area: 'finance',
    action: 'update',
    recordType: 'LedgerEntry',
    recordId: '10',
    recordLabel: 'Ledger entry #10',
    tournamentId: '2027',
    hostCampaignId: '7',
    summary: 'Ari Admin updated ledger entry #10',
    before: {},
    after: { changes: { amount_cents: [100, 200] } },
    metadata: {},
    legacySource: 'finance_audit_events',
    reason: 'Corrected amount',
    requestId: 'request-1',
    httpMethod: 'PATCH',
    routePath: '/api/v1/campaign/example/ledger-entries/10',
  }],
  nextCursor: 'next-page',
  filterOptions: {
    areas: ['finance'],
    actors: [{ id: '1', label: 'Ari Admin' }],
    tournaments: [{ id: '2027', label: '2027' }],
    campaigns: [{ id: '7', label: 'Gold Drive' }],
  },
}

beforeEach(() => vi.mocked(api.adminAuditEvents).mockResolvedValue(firstPage))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('AdminAuditHistoryPage', () => {
  it('shows Guam time and provenance and filters from the details disclosure', async () => {
    render(<MemoryRouter><AdminAuditHistoryPage /></MemoryRouter>)
    await screen.findByText('Ari Admin updated ledger entry #10')
    expect(screen.getByText('Finance ledger')).toBeTruthy()
    expect(screen.getByText(/Jul 1, 2027 · 6:00 PM/)).toBeTruthy()
    expect(screen.getByText(/Corrected amount/)).toBeTruthy()

    const details = screen.getByText('Details')
    fireEvent.click(details)
    expect(details.closest('details')?.open).toBe(true)
    expect(screen.getByRole('table', { name: 'Ari Admin updated ledger entry #10' })).toBeTruthy()
    expect(screen.getByRole('row', { name: 'Amount cents 100 200' })).toBeTruthy()
    expect(screen.getByText(/PATCH \/api/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show related changes' }))
    await waitFor(() => expect(api.adminAuditEvents).toHaveBeenLastCalledWith({ operation_id: 'operation-1', cursor: null }, expect.any(AbortSignal)))

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(api.adminAuditEvents).toHaveBeenLastCalledWith({ cursor: null }, expect.any(AbortSignal)))
  })

  it('applies search and area filters and appends the next page', async () => {
    render(<MemoryRouter><AdminAuditHistoryPage /></MemoryRouter>)
    await screen.findByText('Finance ledger')
    fireEvent.change(screen.getByLabelText('Search history'), { target: { value: 'ledger' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(api.adminAuditEvents).toHaveBeenLastCalledWith({ q: 'ledger', cursor: null }, expect.any(AbortSignal)))
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'finance' } })
    await waitFor(() => expect(api.adminAuditEvents).toHaveBeenLastCalledWith({ q: 'ledger', area: 'finance', cursor: null }, expect.any(AbortSignal)))

    vi.mocked(api.adminAuditEvents).mockResolvedValueOnce({
      nextCursor: null,
      auditEvents: [{ ...firstPage.auditEvents[0], id: '2', summary: 'Ari Admin created a ledger entry' }],
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByText('Ari Admin created a ledger entry')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect((screen.getByLabelText('Area') as HTMLSelectElement).options.length).toBe(2)
  })

  it('shows a truncation notice when exported audit history is capped', async () => {
    vi.mocked(api.adminAuditExport).mockResolvedValueOnce({
      auditEvents: firstPage.auditEvents,
      latestCheckpoint: null,
      truncated: true,
    })
    const createObjectURL = vi.fn(() => 'blob:audit-export')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<MemoryRouter><AdminAuditHistoryPage /></MemoryRouter>)
    await screen.findByText('Finance ledger')
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/Exported the first 1 matching events/)
    clickSpy.mockRestore()
    vi.unstubAllGlobals()
  })
})

it('opens with the campaign filter from a finance history link', async () => {
  render(<MemoryRouter initialEntries={['/admin/audit?hostCampaignId=7']}><AdminAuditHistoryPage /></MemoryRouter>)
  await waitFor(() => expect(api.adminAuditEvents).toHaveBeenCalledWith({ host_campaign_id: '7', cursor: null }, expect.any(AbortSignal)))
})
