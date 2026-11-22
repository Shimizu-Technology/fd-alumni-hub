import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { RECEIPT_UPLOAD_ACCEPT, uploadCampaignReceipt } from '../../lib/uploads'
import type {
  AdminHostCampaign,
  BudgetLineRecord,
  FinanceAuditEvent,
  FinanceSummary,
  LedgerEntryRecord,
  LedgerEntryType,
  PledgeRecord,
  PledgeStatus,
  SignedReceiptUrlResponse,
} from '../../lib/types'
import {
  EmptyState,
  ErrorState,
  Field,
  FormGrid,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
} from '../../components/ui'

type FinanceTab = 'ledger' | 'budget' | 'pledges' | 'reimbursements' | 'audit'

const INCOME_SOURCES = [
  { value: 'fundraiser_gross', label: 'Fundraiser (Gross)' },
  { value: 'fundraiser_net', label: 'Fundraiser (Net payout)' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'donation', label: 'Donation' },
  { value: 'fdaa_allocation', label: 'FDAA Upfront Allocation' },
  { value: 'ticket_share', label: 'FDAA Ticket Share' },
  { value: 'merch', label: 'Merch Sales' },
  { value: 'golf_net', label: 'Golf Tournament (Net)' },
  { value: 'other_income', label: 'Other Income' },
]

const EXPENSE_SOURCES = [
  { value: 'event_expense', label: 'Event Expense' },
  { value: 'merch_cost', label: 'Merch Cost' },
  { value: 'venue_ops', label: 'Venue / Ops' },
  { value: 'refund', label: 'Refund' },
  { value: 'other_expense', label: 'Other Expense' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer / ACH' },
  { value: 'fdaa', label: 'FDAA' },
  { value: 'hafapass_payout', label: 'HåfaPass Payout' },
  { value: 'golf_payout', label: 'Golf Payout' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

const PLEDGE_TIERS = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Donor', 'In-Kind']
const PLEDGE_STATUSES: PledgeStatus[] = ['promised', 'partial', 'fulfilled', 'cancelled']

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function dollarsToCents(raw: string) {
  const parsed = Number(raw.trim().replace(/[$,\s]/g, ''))
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100)
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

function todayIsoDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function AdminCampaignFinancePage() {
  const auth = useAuthContext()
  const isAdmin = Boolean(auth.user?.isAdmin)
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<FinanceTab>('ledger')
  const [entryTypeFilter, setEntryTypeFilter] = useState('')
  const [includeVoided, setIncludeVoided] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [receiptPreview, setReceiptPreview] = useState<SignedReceiptUrlResponse | null>(null)
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState('')

  const adminCampaignsQuery = useAsync(
    () => (isAdmin ? api.adminCampaigns() : Promise.resolve({ campaigns: [] as AdminHostCampaign[] })),
    [isAdmin],
  )

  const campaignOptions = useMemo(() => {
    if (isAdmin && adminCampaignsQuery.data?.campaigns) {
      return adminCampaignsQuery.data.campaigns.map((c) => ({ slug: c.slug, title: c.title, status: c.status }))
    }
    return (auth.user?.campaignMemberships || []).map((m) => ({
      slug: m.campaignSlug,
      title: m.campaignTitle,
      status: m.status,
    }))
  }, [isAdmin, adminCampaignsQuery.data, auth.user?.campaignMemberships])

  const requestedSlug = searchParams.get('campaign')
  const selectedSlug = useMemo(() => {
    if (requestedSlug && campaignOptions.some((c) => c.slug === requestedSlug)) return requestedSlug
    const preferred = campaignOptions.find((c) => c.status === 'active' || c.status === 'closing')
    return preferred?.slug || campaignOptions[0]?.slug || ''
  }, [requestedSlug, campaignOptions])

  const financeQuery = useAsync(async () => {
    if (!selectedSlug) return null
    const [summaryRes, ledgerRes, budgetRes, pledgesRes, auditRes] = await Promise.all([
      api.campaignFinanceSummary(selectedSlug),
      api.campaignLedgerEntries(selectedSlug, { entryType: entryTypeFilter || undefined, includeVoided }),
      api.campaignBudgetLines(selectedSlug, { includeArchived: true }),
      api.campaignPledges(selectedSlug),
      api.campaignFinanceAuditEvents(selectedSlug, 100),
    ])
    return {
      campaign: summaryRes.campaign,
      roles: summaryRes.roles,
      summary: summaryRes.summary,
      ledgerEntries: ledgerRes.ledgerEntries,
      options: ledgerRes.options,
      budgetLines: budgetRes.budgetLines,
      pledges: pledgesRes.pledges,
      sponsors: pledgesRes.sponsors,
      auditEvents: auditRes.auditEvents,
    }
  }, [selectedSlug, entryTypeFilter, includeVoided])

  const handleDownloadCsv = async () => {
    if (!selectedSlug) return
    setExportingCsv(true)
    setCsvError('')
    try {
      const blob = await api.campaignDownloadLedgerCsv(selectedSlug)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${selectedSlug}-ledger-${todayIsoDate()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setCsvError(mutationErrorMessage(err, 'Unable to download CSV export'))
    } finally {
      setExportingCsv(false)
    }
  }

  const handleOpenReceipt = async (entryId: string) => {
    if (!selectedSlug) return
    setReceiptLoadingId(entryId)
    setReceiptError('')
    try {
      const signed = await api.campaignReceiptUrl(selectedSlug, entryId)
      setReceiptPreview(signed)
    } catch (err) {
      setReceiptError(mutationErrorMessage(err, 'Unable to open receipt'))
    } finally {
      setReceiptLoadingId(null)
    }
  }

  if (isAdmin && adminCampaignsQuery.loading && !adminCampaignsQuery.data) {
    return <LoadingState label="Loading host campaigns" />
  }

  if (campaignOptions.length === 0) {
    return (
      <div className="page-stack admin-page">
        <PageHeader
          eyebrow="Board Finance"
          title="Host Year Finance Tracker"
          description="Track fundraising cashflow, sponsor pledges, budget vs actuals, receipts, and officer reimbursements."
        />
        <EmptyState
          title="No host campaigns assigned yet"
          description={isAdmin ? 'Create a host campaign in System → Campaigns to open its finance ledger.' : 'Ask an administrator to invite your email to a host class campaign.'}
          action={isAdmin ? <Link className="btn primary" to="/admin/campaigns">Create campaign</Link> : undefined}
        />
      </div>
    )
  }

  if (financeQuery.loading && !financeQuery.data) {
    return <LoadingState label="Loading campaign finance data" />
  }

  if (financeQuery.error) {
    return <ErrorState message={financeQuery.error} onRetry={financeQuery.reload} />
  }

  const data = financeQuery.data
  if (!data) return null

  const { campaign, roles, summary, ledgerEntries, options, budgetLines, pledges, sponsors, auditEvents } = data
  const isArchived = campaign.status === 'archived'
  const canWriteFinance = (isAdmin || roles.includes('treasurer')) && !isArchived
  const canApproveReimbursements = (isAdmin || roles.includes('chair') || roles.includes('treasurer')) && !isArchived

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Board Finance · Confidential"
        title={`${campaign.title} — Finance`}
        description="Real-time fundraising ledger, budget vs actuals, sponsor pledges, private receipts, and two-officer reimbursement approvals."
        actions={(
          <div className="row-actions">
            {campaignOptions.length > 1 && (
              <select
                aria-label="Select host campaign"
                value={selectedSlug}
                onChange={(e) => setSearchParams({ campaign: e.target.value })}
              >
                {campaignOptions.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>{opt.title} ({opt.status})</option>
                ))}
              </select>
            )}
            <button type="button" className="btn secondary" onClick={() => void handleDownloadCsv()} disabled={exportingCsv}>
              {exportingCsv ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        )}
      />

      {csvError && <Panel><p className="form-error" role="alert" style={{ margin: 0 }}>{csvError}</p></Panel>}
      {receiptError && <Panel><p className="form-error" role="alert" style={{ margin: 0 }}>{receiptError}</p></Panel>}

      {isArchived && (
        <Panel className="state-card">
          <strong>Archived campaign (read-only)</strong>
          <p>This host campaign ledger is closed and preserved read-only for board handoff and audit review.</p>
        </Panel>
      )}

      {!isArchived && !canWriteFinance && (
        <Panel>
          <p className="muted" style={{ margin: 0 }}>
            <strong>Read-only finance access:</strong> Your role ({roles.join(', ') || 'board'}) can view all totals, receipts, audit logs, and CSV exports.
            {canApproveReimbursements ? ' You can also approve out-of-pocket reimbursements.' : ''}
          </p>
        </Panel>
      )}

      {summary.mixedNetEventIds.length > 0 && (
        <Panel>
          <p className="form-error" role="status" style={{ margin: 0 }}>
            <strong>Accounting check:</strong> At least one event mixes a <code>*_net</code> income payout with separate <code>event_expense</code> entries. Review those entries so event costs are not double-counted.
          </p>
        </Panel>
      )}

      <div className="stats-grid four">
        <StatCard label="Goal" value={formatUsd(summary.goalCents)} detail={summary.publicMeterEnabled ? 'Public meter ON' : 'Public meter hidden'} tone="maroon" />
        <StatCard
          label="Raised (Gross)"
          value={formatUsd(summary.raisedCents)}
          detail={`Excl. FDAA: ${formatUsd(summary.raisedExcludingFdaaCents)}`}
          tone="gold"
        />
        <StatCard label="Spent" value={formatUsd(summary.spentCents)} detail={`Net: ${formatUsd(summary.netCents)}`} />
        <StatCard
          label="Still Needed"
          value={formatUsd(summary.stillNeededCents)}
          detail={`Pending reimb: ${formatUsd(summary.pendingReimbursementsCents)} (${summary.pendingReimbursementsCount})`}
        />
      </div>

      <div className="stats-grid three">
        <StatCard
          label="Cash Pledges Outstanding"
          value={formatUsd(summary.outstandingPledgesCents)}
          detail={`Received ${formatUsd(summary.pledgedReceivedCents)} of ${formatUsd(summary.pledgedTotalCents)}`}
        />
        <StatCard
          label="In-Kind Pledges"
          value={summary.inKindPledgesCount}
          detail="Tracked separately from cash raised"
        />
        <StatCard
          label="Public Meter Numerator"
          value={formatUsd(summary.publicMeterRaisedCents)}
          detail={summary.includeFdaaInPublicMeter ? 'Includes FDAA allocation/share' : 'Excludes FDAA allocation/share'}
        />
      </div>

      {canWriteFinance && (
        <FinanceSettingsPanel campaign={campaign} summary={summary} onSaved={financeQuery.reload} />
      )}

      <div className="row-actions" role="tablist" aria-label="Finance tracker tabs" style={{ flexWrap: 'wrap' }}>
        <button type="button" role="tab" aria-selected={tab === 'ledger'} className={`btn ${tab === 'ledger' ? 'primary' : 'secondary'}`} onClick={() => setTab('ledger')}>
          Ledger ({ledgerEntries.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'budget'} className={`btn ${tab === 'budget' ? 'primary' : 'secondary'}`} onClick={() => setTab('budget')}>
          Budget vs Actual ({budgetLines.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'pledges'} className={`btn ${tab === 'pledges' ? 'primary' : 'secondary'}`} onClick={() => setTab('pledges')}>
          Pledges ({pledges.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'reimbursements'} className={`btn ${tab === 'reimbursements' ? 'primary' : 'secondary'}`} onClick={() => setTab('reimbursements')}>
          Reimbursements ({summary.pendingReimbursementsCount})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'audit'} className={`btn ${tab === 'audit' ? 'primary' : 'secondary'}`} onClick={() => setTab('audit')}>
          Audit Log ({auditEvents.length})
        </button>
      </div>

      {tab === 'ledger' && (
        <LedgerTab
          campaign={campaign}
          entries={ledgerEntries}
          options={options}
          canWrite={canWriteFinance}
          entryTypeFilter={entryTypeFilter}
          includeVoided={includeVoided}
          onEntryTypeFilter={setEntryTypeFilter}
          onIncludeVoided={setIncludeVoided}
          onOpenReceipt={handleOpenReceipt}
          receiptLoadingId={receiptLoadingId}
          onSaved={financeQuery.reload}
        />
      )}

      {tab === 'budget' && (
        <BudgetTab
          campaign={campaign}
          summary={summary}
          budgetLines={budgetLines}
          canWrite={canWriteFinance}
          onSaved={financeQuery.reload}
        />
      )}

      {tab === 'pledges' && (
        <PledgesTab
          campaign={campaign}
          pledges={pledges}
          sponsors={sponsors}
          canWrite={canWriteFinance}
          onSaved={financeQuery.reload}
        />
      )}

      {tab === 'reimbursements' && (
        <ReimbursementsTab
          campaign={campaign}
          entries={ledgerEntries}
          currentUserId={auth.user?.id || ''}
          isAdmin={isAdmin}
          canApprove={canApproveReimbursements}
          canMarkReimbursed={canWriteFinance}
          onOpenReceipt={handleOpenReceipt}
          onSaved={financeQuery.reload}
        />
      )}

      {tab === 'audit' && <AuditLogTab auditEvents={auditEvents} />}

      {receiptPreview && (
        <ReceiptPreviewModal receipt={receiptPreview} onClose={() => setReceiptPreview(null)} />
      )}
    </div>
  )
}

function FinanceSettingsPanel({
  campaign,
  summary,
  onSaved,
}: {
  campaign: AdminHostCampaign
  summary: FinanceSummary
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [goalDollars, setGoalDollars] = useState(centsToInput(summary.goalCents))
  const [fdaaUpfrontDollars, setFdaaUpfrontDollars] = useState(centsToInput(summary.fdaaUpfrontCents))
  const [fdaaSharePercent, setFdaaSharePercent] = useState(String((summary.fdaaTicketShareBps / 100).toFixed(summary.fdaaTicketShareBps % 100 === 0 ? 0 : 2)))
  const [publicMeterEnabled, setPublicMeterEnabled] = useState(summary.publicMeterEnabled)
  const [includeFdaaInPublicMeter, setIncludeFdaaInPublicMeter] = useState(summary.includeFdaaInPublicMeter)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setGoalDollars(centsToInput(summary.goalCents))
    setFdaaUpfrontDollars(centsToInput(summary.fdaaUpfrontCents))
    setFdaaSharePercent(String((summary.fdaaTicketShareBps / 100).toFixed(summary.fdaaTicketShareBps % 100 === 0 ? 0 : 2)))
    setPublicMeterEnabled(summary.publicMeterEnabled)
    setIncludeFdaaInPublicMeter(summary.includeFdaaInPublicMeter)
  }, [summary])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await api.campaignUpdateSettings(campaign.slug, {
        goalCents: dollarsToCents(goalDollars),
        fdaaUpfrontCents: dollarsToCents(fdaaUpfrontDollars),
        fdaaTicketShareBps: Math.round((Number(fdaaSharePercent) || 0) * 100),
        publicMeterEnabled,
        includeFdaaInPublicMeter,
      })
      setMessage('Finance settings updated.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to update finance settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="section-heading">
        <div>
          <h2>Goal &amp; public meter settings</h2>
          <p>Treasurers and admins can adjust the fundraising goal, FDAA terms, and whether the public meter is visible.</p>
        </div>
        <button type="button" className="btn secondary small" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide settings' : 'Edit goal & meter'}
        </button>
      </div>
      {open && (
        <form onSubmit={handleSubmit} style={{ marginTop: '0.75rem' }}>
          <FormGrid>
            <Field label="Fundraising goal (USD)">
              <input value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} required />
            </Field>
            <Field label="FDAA upfront allocation (USD)">
              <input value={fdaaUpfrontDollars} onChange={(e) => setFdaaUpfrontDollars(e.target.value)} />
            </Field>
            <Field label="FDAA ticket share (%)">
              <input value={fdaaSharePercent} onChange={(e) => setFdaaSharePercent(e.target.value)} />
            </Field>
          </FormGrid>
          <div className="row-actions" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={publicMeterEnabled} onChange={(e) => setPublicMeterEnabled(e.target.checked)} />
              <span>Enable public fundraising meter on /host-year</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={includeFdaaInPublicMeter} onChange={(e) => setIncludeFdaaInPublicMeter(e.target.checked)} />
              <span>Include FDAA allocation &amp; ticket share in public meter</span>
            </label>
          </div>
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save finance settings'}</button>
          </div>
          {message && <p role="status">{message}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      )}
    </Panel>
  )
}

function LedgerTab({
  campaign,
  entries,
  options,
  canWrite,
  entryTypeFilter,
  includeVoided,
  onEntryTypeFilter,
  onIncludeVoided,
  onOpenReceipt,
  receiptLoadingId,
  onSaved,
}: {
  campaign: AdminHostCampaign
  entries: LedgerEntryRecord[]
  options: {
    budgetLines: Array<{ id: string; kind: LedgerEntryType; category: string }>
    events: Array<{ id: string; title: string }>
    pledges: Array<{ id: string; donorName: string; status: string }>
    sponsors: Array<{ id: string; name: string }>
    members: Array<{ id: string; fullName: string; email: string }>
  }
  canWrite: boolean
  entryTypeFilter: string
  includeVoided: boolean
  onEntryTypeFilter: (value: string) => void
  onIncludeVoided: (value: boolean) => void
  onOpenReceipt: (entryId: string) => Promise<void>
  receiptLoadingId: string | null
  onSaved: () => Promise<void>
}) {
  const [entryType, setEntryType] = useState<LedgerEntryType>('income')
  const [amountDollars, setAmountDollars] = useState('')
  const [entryDate, setEntryDate] = useState(todayIsoDate())
  const [source, setSource] = useState('fundraiser_gross')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [counterparty, setCounterparty] = useState('')
  const [budgetLineId, setBudgetLineId] = useState('')
  const [campaignEventId, setCampaignEventId] = useState('')
  const [sponsorId, setSponsorId] = useState('')
  const [pledgeId, setPledgeId] = useState('')
  const [description, setDescription] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [paidByUserId, setPaidByUserId] = useState('')
  const [requestReimbursement, setRequestReimbursement] = useState(false)
  const [receiptUploadToken, setReceiptUploadToken] = useState('')
  const [receiptFileName, setReceiptFileName] = useState('')
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [attachingEntryId, setAttachingEntryId] = useState<string | null>(null)
  const [voidingEntry, setVoidingEntry] = useState<LedgerEntryRecord | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const availableSources = entryType === 'income' ? INCOME_SOURCES : EXPENSE_SOURCES
  const matchingBudgetLines = options.budgetLines.filter((l) => l.kind === entryType)

  const handleEntryTypeChange = (next: LedgerEntryType) => {
    setEntryType(next)
    setSource(next === 'income' ? 'fundraiser_gross' : 'event_expense')
    setBudgetLineId('')
    if (next === 'income') {
      setPaidBy('')
      setPaidByUserId('')
      setRequestReimbursement(false)
    } else {
      setPledgeId('')
    }
  }

  const handleReceiptSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadingReceipt(true)
    setError('')
    try {
      const token = await uploadCampaignReceipt({ file, campaignSlug: campaign.slug })
      setReceiptUploadToken(token)
      setReceiptFileName(file.name)
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to upload receipt'))
    } finally {
      setUploadingReceipt(false)
    }
  }

  const handleAttachReceiptToExisting = async (entryId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAttachingEntryId(entryId)
    setError('')
    setMessage('')
    try {
      const token = await uploadCampaignReceipt({ file, campaignSlug: campaign.slug })
      await api.campaignUpdateLedgerEntry(campaign.slug, entryId, { receiptUploadToken: token })
      setMessage('Receipt attached.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to attach receipt'))
    } finally {
      setAttachingEntryId(null)
    }
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite) return
    const amountCents = dollarsToCents(amountDollars)
    if (amountCents <= 0) {
      setError('Enter an amount greater than $0.')
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload: Record<string, unknown> = {
        entryType,
        amountCents,
        entryDate: entryDate || undefined,
        source,
        paymentMethod,
        counterparty: counterparty.trim(),
        budgetLineId: budgetLineId || null,
        campaignEventId: campaignEventId || null,
        sponsorId: sponsorId || null,
        pledgeId: entryType === 'income' ? (pledgeId || null) : null,
        description: description.trim() || null,
        referenceNumber: referenceNumber.trim() || null,
        paidBy: entryType === 'expense' ? (paidBy.trim() || null) : null,
        paidByUserId: entryType === 'expense' ? (paidByUserId || null) : null,
        reimbursementStatus: entryType === 'expense' && requestReimbursement ? 'requested' : 'not_applicable',
      }
      if (receiptUploadToken) payload.receiptUploadToken = receiptUploadToken

      await api.campaignCreateLedgerEntry(campaign.slug, payload)
      setAmountDollars('')
      setCounterparty('')
      setDescription('')
      setReferenceNumber('')
      setPaidBy('')
      setPaidByUserId('')
      setRequestReimbursement(false)
      setReceiptUploadToken('')
      setReceiptFileName('')
      setMessage(`${entryType === 'income' ? 'Income' : 'Expense'} recorded.`)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to record ledger entry'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmVoid = async (event: FormEvent) => {
    event.preventDefault()
    if (!voidingEntry || !voidReason.trim()) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await api.campaignVoidLedgerEntry(campaign.slug, voidingEntry.id, voidReason.trim())
      setVoidingEntry(null)
      setVoidReason('')
      setMessage('Ledger entry voided and logged in audit trail.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to void ledger entry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack">
      {canWrite && (
        <Panel>
          <div className="section-heading">
            <h2>Quick add {entryType === 'income' ? 'income' : 'expense'}</h2>
            <div className="row-actions">
              <button type="button" className={`btn small ${entryType === 'income' ? 'primary' : 'secondary'}`} onClick={() => handleEntryTypeChange('income')}>
                + Income
              </button>
              <button type="button" className={`btn small ${entryType === 'expense' ? 'primary' : 'secondary'}`} onClick={() => handleEntryTypeChange('expense')}>
                − Expense
              </button>
            </div>
          </div>

          <form onSubmit={handleCreate}>
            <FormGrid>
              <Field label="Amount (USD)">
                <input inputMode="decimal" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} required placeholder="250.00" />
              </Field>
              <Field label="Date">
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              </Field>
              <Field label="Source">
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  {availableSources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Payment method">
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label={entryType === 'income' ? 'Payer / Donor / Event' : 'Vendor / Payee'}>
                <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} required placeholder={entryType === 'income' ? 'Antigu Night Door / Bank of Guam' : 'Cost-U-Less / DJ'} />
              </Field>
              <Field label="Budget line (optional)">
                <select value={budgetLineId} onChange={(e) => setBudgetLineId(e.target.value)}>
                  <option value="">None</option>
                  {matchingBudgetLines.map((l) => <option key={l.id} value={l.id}>{l.category}</option>)}
                </select>
              </Field>
              <Field label="Fundraiser event (optional)">
                <select value={campaignEventId} onChange={(e) => setCampaignEventId(e.target.value)}>
                  <option value="">None</option>
                  {options.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </Field>
              <Field label="Sponsor (optional)">
                <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)}>
                  <option value="">None</option>
                  {options.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              {entryType === 'income' && (
                <Field label="Apply to cash pledge (optional)">
                  <select value={pledgeId} onChange={(e) => setPledgeId(e.target.value)}>
                    <option value="">None</option>
                    {options.pledges.map((p) => <option key={p.id} value={p.id}>{p.donorName} ({p.status})</option>)}
                  </select>
                </Field>
              )}
              <Field label="Reference # (check / PayPal / transfer)">
                <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="CHK-1024" />
              </Field>
              {entryType === 'expense' && (
                <>
                  <Field label="Paid out-of-pocket by (member account)">
                    <select value={paidByUserId} onChange={(e) => setPaidByUserId(e.target.value)}>
                      <option value="">Paid directly from class account</option>
                      {options.members.map((m) => <option key={m.id} value={m.id}>{m.fullName} ({m.email})</option>)}
                    </select>
                  </Field>
                  <Field label="Paid by display name (if external)">
                    <input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder="Name of person who fronted cash" />
                  </Field>
                </>
              )}
            </FormGrid>

            <Field label="Notes / description">
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            {entryType === 'expense' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={requestReimbursement} onChange={(e) => setRequestReimbursement(e.target.checked)} />
                <span>Request reimbursement (requires second-officer approval)</span>
              </label>
            )}

            <div className="row-actions" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <label className="btn secondary small" style={{ cursor: 'pointer' }}>
                {uploadingReceipt ? 'Uploading receipt…' : receiptFileName ? `Receipt ready: ${receiptFileName}` : 'Attach receipt photo / PDF'}
                <input type="file" accept={RECEIPT_UPLOAD_ACCEPT} onChange={handleReceiptSelect} disabled={uploadingReceipt} style={{ display: 'none' }} />
              </label>
              <button type="submit" className="btn primary" disabled={saving || uploadingReceipt}>
                {saving ? 'Recording…' : `Record ${entryType}`}
              </button>
            </div>
            {message && <p role="status" style={{ marginTop: '0.6rem' }}>{message}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Panel>
      )}

      {voidingEntry && (
        <Panel>
          <div className="section-heading">
            <h2>Void ledger entry #{voidingEntry.id}</h2>
            <button type="button" className="btn secondary small" onClick={() => { setVoidingEntry(null); setVoidReason('') }}>Cancel</button>
          </div>
          <p className="muted">
            Voiding preserves audit history instead of deleting: <strong>{voidingEntry.counterparty}</strong> · {formatUsd(voidingEntry.amountCents)} ({voidingEntry.entryDate}).
          </p>
          <form onSubmit={handleConfirmVoid}>
            <Field label="Reason for void (required)">
              <input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} required placeholder="Duplicate entry / entered wrong amount" />
            </Field>
            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="btn primary" disabled={saving || !voidReason.trim()}>Confirm void</button>
            </div>
          </form>
        </Panel>
      )}

      <Panel>
        <div className="section-heading">
          <h2>Ledger entries ({entries.length})</h2>
          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            <select aria-label="Filter by entry type" value={entryTypeFilter} onChange={(e) => onEntryTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income only</option>
              <option value="expense">Expense only</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={includeVoided} onChange={(e) => onIncludeVoided(e.target.checked)} />
              <span>Show voided</span>
            </label>
          </div>
        </div>

        {entries.length === 0 ? (
          <EmptyState title="No ledger entries yet" description="Record your first fundraiser payout, sponsorship, or expense above." />
        ) : (
          <div className="admin-list">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="compact-admin-row"
                style={{
                  padding: '0.85rem 0',
                  borderBottom: '1px solid var(--line)',
                  opacity: entry.voided ? 0.65 : 1,
                }}
              >
                <div>
                  <strong>
                    {entry.entryType === 'income' ? '+' : '−'}{formatUsd(entry.amountCents)} · {entry.counterparty}
                  </strong>{' '}
                  <span className="pill">{entry.source.replace(/_/g, ' ')}</span>{' '}
                  {entry.voided && <StatusBadge status="cancelled" />}
                  {entry.reimbursementStatus !== 'not_applicable' && (
                    <> <StatusBadge status={entry.reimbursementStatus} /></>
                  )}
                  <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                    {entry.entryDate} · {entry.paymentMethod.replace(/_/g, ' ')}
                    {entry.budgetLineCategory ? ` · ${entry.budgetLineCategory}` : ''}
                    {entry.campaignEventTitle ? ` · ${entry.campaignEventTitle}` : ''}
                    {entry.pledgeDonorName ? ` · Pledge: ${entry.pledgeDonorName}` : ''}
                  </p>
                  {entry.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem' }}>{entry.description}</p>}
                  {entry.voided && entry.voidReason && (
                    <p className="form-error" style={{ margin: '0.2rem 0 0', fontSize: '0.86rem' }}>
                      Voided: {entry.voidReason} ({entry.voidedByName || 'Officer'})
                    </p>
                  )}
                </div>

                <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                  {entry.hasReceipt ? (
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={receiptLoadingId === entry.id}
                      onClick={() => void onOpenReceipt(entry.id)}
                    >
                      {receiptLoadingId === entry.id ? 'Opening…' : 'View receipt'}
                    </button>
                  ) : (
                    canWrite && !entry.voided && (
                      <label className="btn secondary small" style={{ cursor: 'pointer' }}>
                        {attachingEntryId === entry.id ? 'Uploading…' : 'Add receipt'}
                        <input
                          type="file"
                          accept={RECEIPT_UPLOAD_ACCEPT}
                          onChange={(e) => void handleAttachReceiptToExisting(entry.id, e)}
                          disabled={attachingEntryId === entry.id}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )
                  )}
                  {canWrite && !entry.voided && (
                    <button type="button" className="btn secondary small" onClick={() => setVoidingEntry(entry)}>
                      Void
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function BudgetTab({
  campaign,
  summary,
  budgetLines,
  canWrite,
  onSaved,
}: {
  campaign: AdminHostCampaign
  summary: FinanceSummary
  budgetLines: BudgetLineRecord[]
  canWrite: boolean
  onSaved: () => Promise<void>
}) {
  const [kind, setKind] = useState<LedgerEntryType>('expense')
  const [category, setCategory] = useState('')
  const [budgetDollars, setBudgetDollars] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.campaignCreateBudgetLine(campaign.slug, {
        kind,
        category: category.trim(),
        budgetCents: dollarsToCents(budgetDollars),
        notes: notes.trim() || null,
      })
      setCategory('')
      setBudgetDollars('')
      setNotes('')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to create budget line'))
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (line: BudgetLineRecord) => {
    if (!window.confirm(`Archive budget line "${line.category}"? Existing ledger history stays intact.`)) return
    setError('')
    try {
      await api.campaignArchiveBudgetLine(campaign.slug, line.id)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to archive budget line'))
    }
  }

  return (
    <div className="page-stack">
      {canWrite && (
        <Panel>
          <h2>Add budget line</h2>
          <form onSubmit={handleCreate}>
            <FormGrid>
              <Field label="Kind">
                <select value={kind} onChange={(e) => setKind(e.target.value as LedgerEntryType)}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </Field>
              <Field label="Category">
                <input value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="Venue / Jerseys / Fundraiser" />
              </Field>
              <Field label="Planned budget (USD)">
                <input inputMode="decimal" value={budgetDollars} onChange={(e) => setBudgetDollars(e.target.value)} required placeholder="5000" />
              </Field>
              <Field label="Notes">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </FormGrid>
            <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Adding…' : 'Add budget line'}</button>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Panel>
      )}

      <Panel>
        <h2>Budget vs Actual</h2>
        {summary.budgetVsActual.length === 0 ? (
          <EmptyState title="No budget lines yet" description="Add planned income and expense categories to compare against actual ledger totals." />
        ) : (
          <div className="admin-list">
            {summary.budgetVsActual.map((row) => {
              const record = budgetLines.find((b) => b.id === row.id)
              return (
                <div key={row.id} className="compact-admin-row" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <strong>{row.category}</strong>{' '}
                    <span className="pill">{row.kind}</span>{' '}
                    {row.archived && <span className="pill">Archived</span>}
                    <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                      Budget {formatUsd(row.budgetCents)} · Actual {formatUsd(row.actualCents)} · Variance {row.varianceCents >= 0 ? '+' : '−'}{formatUsd(Math.abs(row.varianceCents))}
                    </p>
                  </div>
                  {canWrite && record && !record.archivedAt && (
                    <button type="button" className="btn secondary small" onClick={() => void handleArchive(record)}>
                      Archive
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

function PledgesTab({
  campaign,
  pledges,
  sponsors,
  canWrite,
  onSaved,
}: {
  campaign: AdminHostCampaign
  pledges: PledgeRecord[]
  sponsors: Array<{ id: string; name: string }>
  canWrite: boolean
  onSaved: () => Promise<void>
}) {
  const [donorName, setDonorName] = useState('')
  const [sponsorId, setSponsorId] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [tier, setTier] = useState('Gold')
  const [isInKind, setIsInKind] = useState(false)
  const [promisedDollars, setPromisedDollars] = useState('')
  const [dueOn, setDueOn] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.campaignCreatePledge(campaign.slug, {
        donorName: donorName.trim(),
        sponsorId: sponsorId || null,
        contactInfo: contactInfo.trim() || null,
        tier: tier || null,
        isInKind,
        promisedCents: dollarsToCents(promisedDollars),
        dueOn: dueOn || null,
        notes: notes.trim() || null,
      })
      setDonorName('')
      setSponsorId('')
      setContactInfo('')
      setPromisedDollars('')
      setDueOn('')
      setNotes('')
      setIsInKind(false)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to create pledge'))
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (pledgeId: string, status: PledgeStatus) => {
    setError('')
    try {
      await api.campaignUpdatePledge(campaign.slug, pledgeId, { status })
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to update pledge status'))
    }
  }

  return (
    <div className="page-stack">
      {canWrite && (
        <Panel>
          <h2>Record sponsor or donor pledge</h2>
          <form onSubmit={handleCreate}>
            <FormGrid>
              <Field label="Donor / Sponsor name">
                <input value={donorName} onChange={(e) => setDonorName(e.target.value)} required placeholder="Bank of Guam" />
              </Field>
              <Field label="Linked tournament sponsor (optional)">
                <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)}>
                  <option value="">None</option>
                  {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Promised amount / value (USD)">
                <input inputMode="decimal" value={promisedDollars} onChange={(e) => setPromisedDollars(e.target.value)} required placeholder="2500" />
              </Field>
              <Field label="Tier">
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  {PLEDGE_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Expected date">
                <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </Field>
              <Field label="Contact info (private)">
                <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="Contact name / phone" />
              </Field>
            </FormGrid>
            <Field label="Notes">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={isInKind} onChange={(e) => setIsInKind(e.target.checked)} />
              <span>In-kind donation (tracked separately from cash totals)</span>
            </label>
            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save pledge'}</button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Panel>
      )}

      <Panel>
        <h2>Pledges ({pledges.length})</h2>
        {pledges.length === 0 ? (
          <EmptyState title="No pledges tracked yet" description="Log promised sponsorships or donations to monitor follow-up and fulfillment." />
        ) : (
          <div className="admin-list">
            {pledges.map((p) => (
              <div key={p.id} className="compact-admin-row" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{p.donorName}</strong>{' '}
                  {p.tier && <span className="pill">{p.tier}</span>}{' '}
                  {p.isInKind && <span className="pill">In-Kind</span>}{' '}
                  <StatusBadge status={p.status} />
                  <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                    Promised {formatUsd(p.promisedCents)} · Received {formatUsd(p.receivedCents)} · Outstanding {formatUsd(p.outstandingCents)}
                    {p.overpaymentCents > 0 ? ` · Overpaid +${formatUsd(p.overpaymentCents)}` : ''}
                    {p.dueOn ? ` · Due ${p.dueOn}` : ''}
                  </p>
                </div>
                {canWrite && (
                  <select
                    aria-label={`Status for ${p.donorName}`}
                    value={p.status}
                    onChange={(e) => void handleStatusChange(p.id, e.target.value as PledgeStatus)}
                  >
                    {PLEDGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function ReimbursementsTab({
  campaign,
  entries,
  currentUserId,
  isAdmin,
  canApprove,
  canMarkReimbursed,
  onOpenReceipt,
  onSaved,
}: {
  campaign: AdminHostCampaign
  entries: LedgerEntryRecord[]
  currentUserId: string
  isAdmin: boolean
  canApprove: boolean
  canMarkReimbursed: boolean
  onOpenReceipt: (entryId: string) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const [references, setReferences] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const reimbEntries = entries.filter((e) => !e.voided && e.entryType === 'expense' && e.reimbursementStatus !== 'not_applicable')

  const handleApprove = async (entry: LedgerEntryRecord) => {
    setBusyId(entry.id)
    setError('')
    setMessage('')
    try {
      let overrideReason: string | undefined
      if (!entry.paidByUserId && entry.recordedById === currentUserId && isAdmin) {
        const prompted = window.prompt('Admin override reason (required when approving an entry you recorded):')
        if (!prompted?.trim()) {
          setBusyId(null)
          return
        }
        overrideReason = prompted.trim()
      }
      await api.campaignApproveReimbursement(campaign.slug, entry.id, overrideReason)
      setMessage(`Approved reimbursement for ${entry.counterparty}.`)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to approve reimbursement'))
    } finally {
      setBusyId(null)
    }
  }

  const handleMarkReimbursed = async (entry: LedgerEntryRecord) => {
    setBusyId(entry.id)
    setError('')
    setMessage('')
    try {
      await api.campaignMarkReimbursed(campaign.slug, entry.id, {
        reimbursementReference: references[entry.id]?.trim() || undefined,
      })
      setMessage(`Marked ${entry.counterparty} as reimbursed.`)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to mark reimbursed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Panel>
      <h2>Reimbursement approval queue ({reimbEntries.length})</h2>
      <p className="muted">Separation of duties: the person who paid out of pocket cannot approve their own reimbursement.</p>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {reimbEntries.length === 0 ? (
        <EmptyState title="No reimbursement requests" description="Expenses marked for reimbursement appear here for second-officer approval and payout tracking." />
      ) : (
        <div className="admin-list">
          {reimbEntries.map((entry) => {
            const isSelfPayer = Boolean(entry.paidByUserId && entry.paidByUserId === currentUserId)
            const isRecorderOnly = !entry.paidByUserId && entry.recordedById === currentUserId && !isAdmin
            return (
              <div key={entry.id} className="compact-admin-row" style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{formatUsd(entry.amountCents)} · {entry.counterparty}</strong>{' '}
                  <StatusBadge status={entry.reimbursementStatus} />
                  <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                    Paid by: {entry.paidByUserName || entry.paidBy || 'Unspecified'} · {entry.entryDate}
                    {entry.reimbursementApprovedByName ? ` · Approved by ${entry.reimbursementApprovedByName}` : ''}
                    {entry.reimbursedAt ? ` · Reimbursed ${entry.reimbursedAt}` : ''}
                    {entry.reimbursementReference ? ` (${entry.reimbursementReference})` : ''}
                  </p>
                </div>

                <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                  {entry.hasReceipt && (
                    <button type="button" className="btn secondary small" onClick={() => void onOpenReceipt(entry.id)}>
                      View receipt
                    </button>
                  )}
                  {entry.reimbursementStatus === 'requested' && canApprove && (
                    isSelfPayer || isRecorderOnly ? (
                      <span className="muted" style={{ fontSize: '0.85rem' }}>A second officer must approve</span>
                    ) : (
                      <button type="button" className="btn primary small" disabled={busyId === entry.id} onClick={() => void handleApprove(entry)}>
                        {busyId === entry.id ? 'Approving…' : 'Approve'}
                      </button>
                    )
                  )}
                  {entry.reimbursementStatus === 'approved' && canMarkReimbursed && (
                    <>
                      <input
                        aria-label={`Reimbursement reference for ${entry.counterparty}`}
                        placeholder="Check / transfer ref"
                        value={references[entry.id] || ''}
                        onChange={(e) => setReferences((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                        style={{ maxWidth: '11rem' }}
                      />
                      <button type="button" className="btn primary small" disabled={busyId === entry.id} onClick={() => void handleMarkReimbursed(entry)}>
                        {busyId === entry.id ? 'Saving…' : 'Mark reimbursed'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function AuditLogTab({ auditEvents }: { auditEvents: FinanceAuditEvent[] }) {
  return (
    <Panel>
      <h2>Append-only finance audit log ({auditEvents.length})</h2>
      <p className="muted">Every ledger change, void, receipt attachment/view, reimbursement approval, and settings change is logged.</p>
      {auditEvents.length === 0 ? (
        <EmptyState title="No audit events yet" description="Audit entries appear here automatically as activity occurs." />
      ) : (
        <div className="admin-list">
          {auditEvents.map((ev) => (
            <div key={ev.id} style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
              <strong>{ev.action.replace(/_/g, ' ')}</strong>{' '}
              <span className="pill">{ev.recordType} #{ev.recordId}</span>
              <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
                {ev.actorName || ev.actorEmail || `User #${ev.actorId}`} · {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ''}
                {ev.reason ? ` · Reason: ${ev.reason}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function ReceiptPreviewModal({
  receipt,
  onClose,
}: {
  receipt: SignedReceiptUrlResponse
  onClose: () => void
}) {
  const isHeic = receipt.contentType === 'image/heic'
  const isPdf = receipt.contentType === 'application/pdf'
  const isInlineImage = receipt.contentType.startsWith('image/') && !isHeic

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Receipt: ${receipt.filename}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(23, 20, 26, 0.65)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(48rem, 96vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          display: 'grid',
          gap: '0.85rem',
        }}
      >
        <div className="section-heading">
          <div>
            <h2>{receipt.filename}</h2>
            <p className="muted" style={{ margin: 0 }}>
              Temporary private link expires in {receipt.expiresIn}s · {receipt.contentType}
            </p>
          </div>
          <button type="button" className="btn secondary small" onClick={onClose}>Close</button>
        </div>

        {isInlineImage && (
          <img
            src={receipt.url}
            alt={receipt.filename}
            style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '0.75rem' }}
          />
        )}

        {isPdf && (
          <iframe
            title={receipt.filename}
            src={receipt.url}
            style={{ width: '100%', height: '65vh', border: '1px solid var(--line)', borderRadius: '0.75rem' }}
          />
        )}

        {isHeic && (
          <div className="state-card">
            <p>HEIC photos cannot be previewed inline in most desktop browsers.</p>
            <a className="btn primary" href={receipt.url} target="_blank" rel="noreferrer">
              Download HEIC receipt
            </a>
          </div>
        )}

        {!isHeic && (
          <div className="row-actions">
            <a className="btn secondary small" href={receipt.url} target="_blank" rel="noreferrer">
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
