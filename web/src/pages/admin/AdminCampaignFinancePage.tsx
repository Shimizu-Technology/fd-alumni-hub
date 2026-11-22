import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref } from '../../lib/urls'
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

type FinanceTab = 'ledger' | 'budget' | 'pledges' | 'reimbursements' | 'audit' | 'report'

const MAX_DOLLARS = 1_000_000_000 // $1B cap matching backend MAX_CENTS
const DOLLAR_REGEX = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/

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

const MODAL_FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function parseDollarsToCents(raw: string, { positive = false }: { positive?: boolean } = {}): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/^\$\s*/, '')
  if (!trimmed || !DOLLAR_REGEX.test(trimmed)) {
    return { ok: false, error: 'Enter a valid dollar amount (for example, 250, 1,250.00, or 250.50).' }
  }
  const parsed = Number(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(parsed) || parsed > MAX_DOLLARS || (positive ? parsed <= 0 : parsed < 0)) {
    return { ok: false, error: positive ? 'Amount must be greater than $0 and within range.' : 'Amount must be non-negative and within range.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

function parsePercentToBps(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/%$/, '').trim()
  if (!trimmed || !/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a valid percentage between 0 and 100.' }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return { ok: false, error: 'Percentage must be between 0 and 100.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

function todayIsoDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function useAccessibleModal(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>, initialFocusRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef.current) initialFocusRef.current.focus({ preventScroll: true })
      else panelRef.current?.focus({ preventScroll: true })
    }, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE) || [])
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current?.focus({ preventScroll: true })
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [open, panelRef, initialFocusRef])
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
  const [receiptPreview, setReceiptPreview] = useState<{ entryId: string; signed: SignedReceiptUrlResponse; fetchedAt: number } | null>(null)
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

  const selectedSlugRef = useRef(selectedSlug)
  const receiptReqIdRef = useRef(0)

  useEffect(() => {
    selectedSlugRef.current = selectedSlug
    receiptReqIdRef.current += 1
    setReceiptPreview(null)
    setReceiptLoadingId(null)
    setCsvError('')
    setReceiptError('')
  }, [selectedSlug])

  const handleCloseReceipt = () => {
    receiptReqIdRef.current += 1
    setReceiptPreview(null)
    setReceiptLoadingId(null)
    setReceiptError('')
  }

  // Core overview + secondary tabs loaded with allSettled so partial failures never crash the ledger
  const overviewQuery = useAsync(async () => {
    if (!selectedSlug) return null
    const summaryRes = await api.campaignFinanceSummary(selectedSlug)
    const [budgetSettled, pledgesSettled, reimbSettled, auditSettled] = await Promise.allSettled([
      api.campaignBudgetLines(selectedSlug, { includeArchived: true }),
      api.campaignPledges(selectedSlug),
      api.campaignLedgerEntries(selectedSlug, { entryType: 'expense', includeVoided: false }),
      api.campaignFinanceAuditEvents(selectedSlug, 100),
    ])
    return {
      slug: selectedSlug,
      campaign: summaryRes.campaign,
      roles: summaryRes.roles,
      summary: summaryRes.summary,
      budgetLines: budgetSettled.status === 'fulfilled' ? budgetSettled.value.budgetLines : [],
      budgetError: budgetSettled.status === 'rejected' ? mutationErrorMessage(budgetSettled.reason, 'Unable to load budget lines') : null,
      pledges: pledgesSettled.status === 'fulfilled' ? pledgesSettled.value.pledges : [],
      sponsors: pledgesSettled.status === 'fulfilled' ? pledgesSettled.value.sponsors : [],
      pledgesError: pledgesSettled.status === 'rejected' ? mutationErrorMessage(pledgesSettled.reason, 'Unable to load pledges') : null,
      reimbursementExpenses: reimbSettled.status === 'fulfilled' ? reimbSettled.value.ledgerEntries : [],
      reimbursementsError: reimbSettled.status === 'rejected' ? mutationErrorMessage(reimbSettled.reason, 'Unable to load reimbursements') : null,
      auditEvents: auditSettled.status === 'fulfilled' ? auditSettled.value.auditEvents : [],
      auditError: auditSettled.status === 'rejected' ? mutationErrorMessage(auditSettled.reason, 'Unable to load audit log') : null,
    }
  }, [selectedSlug])

  // Filtered ledger query runs independently so changing ledger filters doesn't refetch summary/budget/audit
  const ledgerQuery = useAsync(async () => {
    if (!selectedSlug) return null
    const res = await api.campaignLedgerEntries(selectedSlug, {
      entryType: entryTypeFilter || undefined,
      includeVoided,
    })
    return { slug: selectedSlug, entryTypeFilter, includeVoided, ...res }
  }, [selectedSlug, entryTypeFilter, includeVoided])

  const reloadAll = async () => {
    await Promise.all([overviewQuery.reload(), ledgerQuery.reload()])
  }

  const handleDownloadCsv = async () => {
    const slugAtStart = selectedSlug
    if (!slugAtStart) return
    setExportingCsv(true)
    setCsvError('')
    try {
      const blob = await api.campaignDownloadLedgerCsv(slugAtStart)
      if (selectedSlugRef.current !== slugAtStart) return
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${slugAtStart}-ledger-${todayIsoDate()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
    } catch (err) {
      if (selectedSlugRef.current === slugAtStart) {
        setCsvError(mutationErrorMessage(err, 'Unable to download CSV export'))
      }
    } finally {
      setExportingCsv(false)
    }
  }

  const handleOpenReceipt = async (entryId: string) => {
    const slugAtStart = selectedSlug
    if (!slugAtStart) return
    const reqId = ++receiptReqIdRef.current
    setReceiptLoadingId(entryId)
    setReceiptError('')
    try {
      const signed = await api.campaignReceiptUrl(slugAtStart, entryId)
      if (receiptReqIdRef.current !== reqId || selectedSlugRef.current !== slugAtStart) return
      setReceiptPreview({ entryId, signed, fetchedAt: Date.now() })
    } catch (err) {
      if (receiptReqIdRef.current === reqId && selectedSlugRef.current === slugAtStart) {
        setReceiptError(mutationErrorMessage(err, 'Unable to open receipt'))
      }
    } finally {
      if (receiptReqIdRef.current === reqId) {
        setReceiptLoadingId(null)
      }
    }
  }

  if (isAdmin && adminCampaignsQuery.loading && !adminCampaignsQuery.data) {
    return <LoadingState label="Loading host campaigns" />
  }

  if (isAdmin && adminCampaignsQuery.error) {
    return <ErrorState message={adminCampaignsQuery.error} onRetry={adminCampaignsQuery.reload} />
  }

  if (campaignOptions.length === 0) {
    return (
      <div className="page-stack admin-page finance-page">
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

  const overviewMatchesSlug = Boolean(overviewQuery.data && overviewQuery.data.slug === selectedSlug)

  if (overviewQuery.error && !overviewMatchesSlug) {
    return <ErrorState message={overviewQuery.error} onRetry={overviewQuery.reload} />
  }

  if (!overviewMatchesSlug || !overviewQuery.data) {
    return <LoadingState label="Loading campaign finance data" />
  }

  const data = overviewQuery.data

  const {
    campaign,
    roles,
    summary,
    budgetLines,
    budgetError,
    pledges,
    sponsors,
    pledgesError,
    reimbursementExpenses,
    reimbursementsError,
    auditEvents,
    auditError,
  } = data

  const ledgerReady = Boolean(
    ledgerQuery.data &&
    ledgerQuery.data.slug === selectedSlug &&
    ledgerQuery.data.entryTypeFilter === entryTypeFilter &&
    ledgerQuery.data.includeVoided === includeVoided
  )
  const ledgerEntries = ledgerReady ? (ledgerQuery.data?.ledgerEntries || []) : []
  const ledgerOptions = ledgerQuery.data && ledgerQuery.data.slug === selectedSlug
    ? ledgerQuery.data.options
    : { budgetLines: [], events: [], pledges: [], sponsors: [], members: [] }

  const isArchived = campaign.status === 'archived'
  const canWriteFinance = (isAdmin || roles.includes('treasurer')) && !isArchived
  const canApproveReimbursements = (isAdmin || roles.includes('chair') || roles.includes('treasurer')) && !isArchived

  return (
    <div className="page-stack admin-page finance-page">
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
            <button
              type="button"
              className="btn secondary"
              title="Downloads the complete campaign ledger (including voided entries) as a CSV file"
              onClick={() => void handleDownloadCsv()}
              disabled={exportingCsv}
            >
              {exportingCsv ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        )}
      />

      {csvError && <Panel><p className="form-error" role="alert" style={{ margin: 0 }}>{csvError}</p></Panel>}
      {receiptError && !receiptPreview && <Panel><p className="form-error" role="alert" style={{ margin: 0 }}>{receiptError}</p></Panel>}
      {overviewQuery.error && (
        <Panel>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            <p className="form-error" role="alert" style={{ margin: 0 }}>
              Totals may be out of date: {overviewQuery.error}
            </p>
            <button type="button" className="btn secondary small" onClick={() => void overviewQuery.reload()}>
              Retry
            </button>
          </div>
        </Panel>
      )}

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
            <strong>Accounting check:</strong> Event(s) #{summary.mixedNetEventIds.join(', #')} mix a <code>*_net</code> income payout with separate <code>event_expense</code> entries. Review those entries so event costs are not double-counted.
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
        <FinanceSettingsPanel key={campaign.slug} campaign={campaign} summary={summary} onSaved={reloadAll} />
      )}

      <nav className="finance-tabs" aria-label="Finance tracker sections">
        <button type="button" aria-current={tab === 'ledger' ? 'page' : undefined} className={`btn small ${tab === 'ledger' ? 'primary' : 'secondary'}`} onClick={() => setTab('ledger')}>
          Ledger ({ledgerEntries.length})
        </button>
        <button type="button" aria-current={tab === 'budget' ? 'page' : undefined} className={`btn small ${tab === 'budget' ? 'primary' : 'secondary'}`} onClick={() => setTab('budget')}>
          Budget ({summary.budgetVsActual.length})
        </button>
        <button type="button" aria-current={tab === 'pledges' ? 'page' : undefined} className={`btn small ${tab === 'pledges' ? 'primary' : 'secondary'}`} onClick={() => setTab('pledges')}>
          Pledges ({pledges.length})
        </button>
        <button type="button" aria-current={tab === 'reimbursements' ? 'page' : undefined} className={`btn small ${tab === 'reimbursements' ? 'primary' : 'secondary'}`} onClick={() => setTab('reimbursements')}>
          Reimbursements ({summary.pendingReimbursementsCount})
        </button>
        <button type="button" aria-current={tab === 'audit' ? 'page' : undefined} className={`btn small ${tab === 'audit' ? 'primary' : 'secondary'}`} onClick={() => setTab('audit')}>
          Audit Log ({auditEvents.length})
        </button>
        <button type="button" aria-current={tab === 'report' ? 'page' : undefined} className={`btn small ${tab === 'report' ? 'primary' : 'secondary'}`} onClick={() => setTab('report')}>
          Final Report
        </button>
      </nav>

      {tab === 'ledger' && (
        <LedgerTab
          key={campaign.slug}
          campaign={campaign}
          entries={ledgerEntries}
          loading={ledgerQuery.loading || (!ledgerReady && !ledgerQuery.error)}
          ledgerError={ledgerQuery.error}
          onRetryLedger={ledgerQuery.reload}
          options={ledgerOptions}
          canWrite={canWriteFinance}
          entryTypeFilter={entryTypeFilter}
          includeVoided={includeVoided}
          onEntryTypeFilter={setEntryTypeFilter}
          onIncludeVoided={setIncludeVoided}
          onOpenReceipt={handleOpenReceipt}
          receiptLoadingId={receiptLoadingId}
          onSaved={reloadAll}
        />
      )}

      {tab === 'budget' && (
        budgetError ? (
          <ErrorState message={budgetError} onRetry={overviewQuery.reload} />
        ) : (
          <BudgetTab
            key={campaign.slug}
            campaign={campaign}
            summary={summary}
            budgetLines={budgetLines}
            canWrite={canWriteFinance}
            onSaved={reloadAll}
          />
        )
      )}

      {tab === 'pledges' && (
        pledgesError ? (
          <ErrorState message={pledgesError} onRetry={overviewQuery.reload} />
        ) : (
          <PledgesTab
            key={campaign.slug}
            campaign={campaign}
            pledges={pledges}
            sponsors={sponsors}
            canWrite={canWriteFinance}
            onSaved={reloadAll}
          />
        )
      )}

      {tab === 'reimbursements' && (
        reimbursementsError ? (
          <ErrorState message={reimbursementsError} onRetry={overviewQuery.reload} />
        ) : (
          <ReimbursementsTab
            key={campaign.slug}
            campaign={campaign}
            entries={reimbursementExpenses}
            currentUserId={auth.user?.id || ''}
            isAdmin={isAdmin}
            canApprove={canApproveReimbursements}
            canMarkReimbursed={canWriteFinance}
            receiptLoadingId={receiptLoadingId}
            onOpenReceipt={handleOpenReceipt}
            onSaved={reloadAll}
          />
        )
      )}

      {tab === 'audit' && (
        auditError ? (
          <ErrorState message={auditError} onRetry={overviewQuery.reload} />
        ) : (
          <AuditLogTab auditEvents={auditEvents} />
        )
      )}

      {tab === 'report' && (
        <FinalReportTab key={campaign.slug} campaignSlug={campaign.slug} />
      )}

      {receiptPreview && (
        <ReceiptPreviewModal
          receipt={receiptPreview.signed}
          fetchedAt={receiptPreview.fetchedAt}
          refreshing={receiptLoadingId === receiptPreview.entryId}
          error={receiptError}
          onRefresh={() => void handleOpenReceipt(receiptPreview.entryId)}
          onClose={handleCloseReceipt}
        />
      )}
    </div>
  )
}

function FinalReportTab({ campaignSlug }: { campaignSlug: string }) {
  const { data, loading, error, reload } = useAsync(
    () => api.campaignFinalReport(campaignSlug),
    [campaignSlug],
  )

  if (loading && !data) return <LoadingState label="Generating board final report" />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null

  const { campaign, tournamentOutcomes, finance, compliance } = data

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${campaign.slug}-final-report-${todayIsoDate()}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }

  const downloadSummaryCsv = () => {
    const escapeCell = (val: string | number) => {
      const text = String(val)
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }
    const rows: Array<[string, string, string | number]> = [
      ['Campaign', 'Title', campaign.title],
      ['Campaign', 'Slug', campaign.slug],
      ['Campaign', 'Status', campaign.status],
      ['Tournament', 'Year', tournamentOutcomes.tournament?.year ?? ''],
      ['Tournament', 'Teams', tournamentOutcomes.teamsCount],
      ['Tournament', 'Divisions', tournamentOutcomes.divisionsCount],
      ['Tournament', 'Pool Games', tournamentOutcomes.poolGamesCount],
      ['Tournament', 'Playoff Games', tournamentOutcomes.playoffGamesCount],
      ['Tournament', 'Pool Score Coverage %', tournamentOutcomes.scoreCoverage.percent],
      ['Finance', 'Goal (USD)', (finance.goalCents / 100).toFixed(2)],
      ['Finance', 'Total Raised (USD)', (finance.raisedCents / 100).toFixed(2)],
      ['Finance', 'Total Spent (USD)', (finance.spentCents / 100).toFixed(2)],
      ['Finance', 'Net Balance (USD)', (finance.netCents / 100).toFixed(2)],
      ['Finance', 'Outstanding Cash Pledges (USD)', (finance.outstandingPledgesCents / 100).toFixed(2)],
      ['Finance', 'Pending Reimbursements (USD)', (finance.pendingReimbursementsCents / 100).toFixed(2)],
      ['Compliance', 'Live Expenses', compliance.liveExpensesCount],
      ['Compliance', 'Expenses Missing Receipt', compliance.expensesMissingReceiptCount],
      ['Compliance', 'Pending Reimbursements', compliance.pendingReimbursementsCount],
      ['Compliance', 'Open Cash Pledges', compliance.openCashPledgesCount],
      ['Compliance', 'Voided Entries', compliance.voidedEntriesCount],
      ['Compliance', 'Unfinalized Games', compliance.unfinalizedGamesCount],
      ['Compliance', 'Ready to Archive', compliance.readyToArchive ? 'Yes' : 'No'],
    ]
    const csv = ['Section,Metric,Value', ...rows.map((r) => r.map(escapeCell).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${campaign.slug}-final-report-summary-${todayIsoDate()}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="page-stack final-report-sheet">
      <Panel>
        <div className="section-heading">
          <div>
            <h2>Board Final Report — {campaign.title}</h2>
            <p className="muted">Generated {new Date(data.generatedAt).toLocaleString()} · Status: {campaign.status}</p>
          </div>
          <div className="row-actions no-print">
            <button type="button" className="btn primary small" onClick={() => window.print()}>Print / Save PDF</button>
            <button type="button" className="btn secondary small" onClick={downloadSummaryCsv}>Summary CSV</button>
            <button type="button" className="btn secondary small" onClick={downloadJson}>JSON</button>
          </div>
        </div>

        <div className="stats-grid four">
          <StatCard label="Total Raised" value={formatUsd(finance.raisedCents)} detail={`Goal ${formatUsd(finance.goalCents)}`} tone="maroon" />
          <StatCard label="Total Spent" value={formatUsd(finance.spentCents)} detail={`${compliance.liveExpensesCount} live expenses`} />
          <StatCard label="Net Balance" value={formatUsd(finance.netCents)} detail={`FDAA upfront ${formatUsd(finance.fdaaUpfrontCents)}`} tone="gold" />
          <StatCard
            label="Archive Readiness"
            value={compliance.readyToArchive ? 'Ready' : `${compliance.blockers.length} blocker${compliance.blockers.length === 1 ? '' : 's'}`}
            detail={`${compliance.warnings.length} warning${compliance.warnings.length === 1 ? '' : 's'}`}
          />
        </div>
      </Panel>

      <Panel>
        <h3>Tournament Outcomes</h3>
        <div className="stats-grid four">
          <StatCard label="Teams" value={tournamentOutcomes.teamsCount} detail={`${tournamentOutcomes.divisionsCount} active divisions`} />
          <StatCard label="Pool Games" value={tournamentOutcomes.poolGamesCount} detail={`${tournamentOutcomes.scoreCoverage.percent}% pool score coverage`} />
          <StatCard label="Playoff Games" value={tournamentOutcomes.playoffGamesCount} detail={`${tournamentOutcomes.otherGamesCount} special/other`} />
          <StatCard label="Champions Recorded" value={tournamentOutcomes.champions.length} detail={tournamentOutcomes.tournament?.status || '—'} />
        </div>
        {tournamentOutcomes.champions.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <strong>Recorded Champions</strong>
            <ul>
              {tournamentOutcomes.champions.map((champ) => (
                <li key={champ.id}>
                  <strong>{champ.label}:</strong> {champ.championLabel || 'TBD'}
                  {champ.runnerUpLabel ? ` over ${champ.runnerUpLabel}` : ''}
                  {champ.score ? ` (${champ.score})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel>
        <h3>Financial Breakdown</h3>
        {finance.bySource.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Type</th><th>Source</th><th>Total</th></tr>
              </thead>
              <tbody>
                {finance.bySource.map((row) => (
                  <tr key={`${row.entryType}-${row.source}`}>
                    <td>{row.entryType}</td>
                    <td>{row.source.replace(/_/g, ' ')}</td>
                    <td>{formatUsd(row.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {finance.budgetVsActual.length > 0 && (
          <div className="table-scroll" style={{ marginTop: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr><th>Category</th><th>Kind</th><th>Budget</th><th>Actual</th><th>Variance</th></tr>
              </thead>
              <tbody>
                {finance.budgetVsActual.map((line) => (
                  <tr key={line.id}>
                    <td>{line.category}</td>
                    <td>{line.kind}</td>
                    <td>{formatUsd(line.budgetCents)}</td>
                    <td>{formatUsd(line.actualCents)}</td>
                    <td>{formatUsd(line.varianceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <h3>Close-Out Compliance Checklist</h3>
        <ul>
          <li>Live expenses: <strong>{compliance.liveExpensesCount}</strong> ({compliance.expensesMissingReceiptCount} missing receipt)</li>
          <li>Pending reimbursements: <strong>{compliance.pendingReimbursementsCount}</strong></li>
          <li>Open cash pledges: <strong>{compliance.openCashPledgesCount}</strong></li>
          <li>Unfinalized non-placeholder games: <strong>{compliance.unfinalizedGamesCount}</strong></li>
          <li>Voided ledger entries: <strong>{compliance.voidedEntriesCount}</strong> · Audit events logged: <strong>{compliance.auditEventsCount}</strong></li>
        </ul>

        {compliance.blockers.length > 0 && (
          <div className="scorekeeper-error-box" style={{ marginTop: '0.75rem' }}>
            <strong>Close-out blockers</strong>
            <ul>
              {compliance.blockers.map((b) => <li key={b.code}>{b.message}</li>)}
            </ul>
          </div>
        )}

        {compliance.warnings.length > 0 && (
          <div className="panel tickets-stale-banner" style={{ marginTop: '0.75rem' }}>
            <div>
              <strong>Warnings to review before archiving</strong>
              <ul>
                {compliance.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
              </ul>
            </div>
          </div>
        )}
      </Panel>
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
    if (open) return
    setGoalDollars(centsToInput(summary.goalCents))
    setFdaaUpfrontDollars(centsToInput(summary.fdaaUpfrontCents))
    setFdaaSharePercent(String((summary.fdaaTicketShareBps / 100).toFixed(summary.fdaaTicketShareBps % 100 === 0 ? 0 : 2)))
    setPublicMeterEnabled(summary.publicMeterEnabled)
    setIncludeFdaaInPublicMeter(summary.includeFdaaInPublicMeter)
  }, [summary, open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const goalParsed = parseDollarsToCents(goalDollars, { positive: true })
    if (!goalParsed.ok) {
      setError(`Fundraising goal: ${goalParsed.error}`)
      return
    }
    const upfrontParsed = parseDollarsToCents(fdaaUpfrontDollars)
    if (!upfrontParsed.ok) {
      setError(`FDAA upfront allocation: ${upfrontParsed.error}`)
      return
    }
    const shareParsed = parsePercentToBps(fdaaSharePercent)
    if (!shareParsed.ok) {
      setError(`FDAA ticket share: ${shareParsed.error}`)
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await api.campaignUpdateSettings(campaign.slug, {
        goalCents: goalParsed.value,
        fdaaUpfrontCents: upfrontParsed.value,
        fdaaTicketShareBps: shareParsed.value,
        publicMeterEnabled,
        includeFdaaInPublicMeter,
      })
      setMessage('Finance settings updated.')
      setOpen(false)
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
      {message && !open && <p role="status" style={{ marginTop: '0.5rem' }}>{message}</p>}
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
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      )}
    </Panel>
  )
}

function LedgerTab({
  campaign,
  entries,
  loading,
  ledgerError,
  onRetryLedger,
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
  loading: boolean
  ledgerError: string | null
  onRetryLedger: () => Promise<void>
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
    const amountParsed = parseDollarsToCents(amountDollars, { positive: true })
    if (!amountParsed.ok) {
      setError(`Amount: ${amountParsed.error}`)
      return
    }
    const amountCents = amountParsed.value
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
      const msg = mutationErrorMessage(err, 'Unable to record ledger entry')
      if (receiptUploadToken && /token|expired/i.test(msg)) {
        setReceiptUploadToken('')
        setReceiptFileName('')
        setError(`${msg} Please re-attach the receipt and try again.`)
      } else {
        setError(msg)
      }
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
              <label className="btn secondary small file-upload-btn">
                <span>{uploadingReceipt ? 'Uploading receipt…' : receiptFileName ? `Receipt ready: ${receiptFileName}` : 'Attach receipt photo / PDF'}</span>
                <input className="sr-only" type="file" accept={RECEIPT_UPLOAD_ACCEPT} onChange={handleReceiptSelect} disabled={uploadingReceipt} />
              </label>
              {receiptUploadToken && !uploadingReceipt && (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => {
                    setReceiptUploadToken('')
                    setReceiptFileName('')
                  }}
                >
                  Remove receipt
                </button>
              )}
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
        <VoidEntryModal
          campaignSlug={campaign.slug}
          entry={voidingEntry}
          onClose={() => setVoidingEntry(null)}
          onVoided={async () => {
            const targetId = voidingEntry.id
            setVoidingEntry((prev) => (prev?.id === targetId ? null : prev))
            setMessage('Ledger entry voided and logged in audit trail.')
            await onSaved()
          }}
        />
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

        {ledgerError ? (
          <ErrorState message={ledgerError} onRetry={onRetryLedger} />
        ) : loading ? (
          <LoadingState label="Loading ledger entries" />
        ) : entries.length === 0 ? (
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
                  {entry.voided && <span className="status-badge status-cancelled">voided</span>}
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
                      <label className="btn secondary small file-upload-btn">
                        <span>{attachingEntryId === entry.id ? 'Uploading…' : 'Add receipt'}</span>
                        <input
                          className="sr-only"
                          type="file"
                          accept={RECEIPT_UPLOAD_ACCEPT}
                          onChange={(e) => void handleAttachReceiptToExisting(entry.id, e)}
                          disabled={attachingEntryId === entry.id}
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

function VoidEntryModal({
  campaignSlug,
  entry,
  onClose,
  onVoided,
}: {
  campaignSlug: string
  entry: LedgerEntryRecord
  onClose: () => void
  onVoided: () => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useAccessibleModal(true, onClose, panelRef, inputRef)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reason.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.campaignVoidLedgerEntry(campaignSlug, entry.id, reason.trim())
      await onVoided()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to void ledger entry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        className="panel finance-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Void ledger entry ${entry.id}`}
        tabIndex={-1}
      >
        <div className="section-heading">
          <h2>Void ledger entry #{entry.id}</h2>
          <button type="button" className="btn secondary small" onClick={onClose}>Cancel</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Voiding preserves audit history instead of deleting: <strong>{entry.counterparty}</strong> · {formatUsd(entry.amountCents)} ({entry.entryDate}).
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Reason for void (required)">
            <input ref={inputRef} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Duplicate entry / entered wrong amount" />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn secondary" onClick={onClose}>Keep entry</button>
            <button type="submit" className="btn primary" disabled={saving || !reason.trim()}>
              {saving ? 'Voiding…' : 'Confirm void'}
            </button>
          </div>
        </form>
      </div>
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
    const budgetParsed = parseDollarsToCents(budgetDollars)
    if (!budgetParsed.ok) {
      setError(`Planned budget: ${budgetParsed.error}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.campaignCreateBudgetLine(campaign.slug, {
        kind,
        category: category.trim(),
        budgetCents: budgetParsed.value,
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
              const varianceLabel = row.varianceCents === 0
                ? 'On budget'
                : row.kind === 'expense'
                  ? (row.varianceCents > 0 ? `${formatUsd(row.varianceCents)} over budget` : `${formatUsd(Math.abs(row.varianceCents))} under budget`)
                  : (row.varianceCents > 0 ? `${formatUsd(row.varianceCents)} above target` : `${formatUsd(Math.abs(row.varianceCents))} below target`)

              return (
                <div key={row.id} className="compact-admin-row" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <strong>{row.category}</strong>{' '}
                    <span className="pill">{row.kind}</span>{' '}
                    {row.archived && <span className="pill">Archived</span>}
                    <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                      Budget {formatUsd(row.budgetCents)} · Actual {formatUsd(row.actualCents)} · {varianceLabel}
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
    const promisedParsed = parseDollarsToCents(promisedDollars, { positive: true })
    if (!promisedParsed.ok) {
      setError(`Promised amount: ${promisedParsed.error}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.campaignCreatePledge(campaign.slug, {
        donorName: donorName.trim(),
        sponsorId: sponsorId || null,
        contactInfo: contactInfo.trim() || null,
        tier: tier || null,
        isInKind,
        promisedCents: promisedParsed.value,
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
        <p className="muted">Cash pledge fulfillment updates automatically as linked income entries are recorded or voided.</p>
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
                    Promised {formatUsd(p.promisedCents)}
                    {!p.isInKind && (
                      <>
                        {' '}· Received {formatUsd(p.receivedCents)} · Outstanding {formatUsd(p.outstandingCents)}
                        {p.overpaymentCents > 0 ? ` · Overpaid +${formatUsd(p.overpaymentCents)}` : ''}
                      </>
                    )}
                    {p.dueOn ? ` · Due ${p.dueOn}` : ''}
                  </p>
                </div>
                {canWrite && (
                  p.isInKind ? (
                    <select
                      aria-label={`Status for ${p.donorName}`}
                      value={p.status}
                      onChange={(e) => void handleStatusChange(p.id, e.target.value as PledgeStatus)}
                    >
                      {PLEDGE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : p.status === 'cancelled' ? (
                    <button type="button" className="btn secondary small" onClick={() => void handleStatusChange(p.id, 'promised')}>
                      Reopen pledge
                    </button>
                  ) : p.receivedCents === 0 ? (
                    <button type="button" className="btn secondary small" onClick={() => void handleStatusChange(p.id, 'cancelled')}>
                      Cancel pledge
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: '0.85rem' }}>Auto-synced</span>
                  )
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
  receiptLoadingId,
  onOpenReceipt,
  onSaved,
}: {
  campaign: AdminHostCampaign
  entries: LedgerEntryRecord[]
  currentUserId: string
  isAdmin: boolean
  canApprove: boolean
  canMarkReimbursed: boolean
  receiptLoadingId: string | null
  onOpenReceipt: (entryId: string) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const [references, setReferences] = useState<Record<string, string>>({})
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const setEntryBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (busy) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const reimbEntries = entries.filter((e) => !e.voided && e.entryType === 'expense' && e.reimbursementStatus !== 'not_applicable')

  const handleApprove = async (entry: LedgerEntryRecord) => {
    setEntryBusy(entry.id, true)
    setError('')
    setMessage('')
    try {
      let overrideReason: string | undefined
      if (entry.recordedById === currentUserId && isAdmin) {
        const prompted = window.prompt('Admin override reason (required when approving an entry you recorded):')
        if (!prompted?.trim()) {
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
      setEntryBusy(entry.id, false)
    }
  }

  const handleMarkReimbursed = async (entry: LedgerEntryRecord) => {
    setEntryBusy(entry.id, true)
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
      setEntryBusy(entry.id, false)
    }
  }

  return (
    <Panel>
      <h2>Reimbursement approval queue ({reimbEntries.length})</h2>
      <p className="muted">Separation of duties: neither the out-of-pocket payer nor the officer who recorded the expense can self-approve.</p>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {reimbEntries.length === 0 ? (
        <EmptyState title="No reimbursement requests" description="Expenses marked for reimbursement appear here for second-officer approval and payout tracking." />
      ) : (
        <div className="admin-list">
          {reimbEntries.map((entry) => {
            const isSelfPayer = Boolean(entry.paidByUserId && entry.paidByUserId === currentUserId)
            const isRecorderOnly = entry.recordedById === currentUserId && !isAdmin
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
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={receiptLoadingId === entry.id}
                      onClick={() => void onOpenReceipt(entry.id)}
                    >
                      {receiptLoadingId === entry.id ? 'Opening…' : 'View receipt'}
                    </button>
                  )}
                  {entry.reimbursementStatus === 'requested' && canApprove && (
                    isSelfPayer || isRecorderOnly ? (
                      <span className="muted" style={{ fontSize: '0.85rem' }}>A second officer must approve</span>
                    ) : (
                      <button type="button" className="btn primary small" disabled={Boolean(busyIds[entry.id])} onClick={() => void handleApprove(entry)}>
                        {busyIds[entry.id] ? 'Approving…' : 'Approve'}
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
                      <button type="button" className="btn primary small" disabled={Boolean(busyIds[entry.id])} onClick={() => void handleMarkReimbursed(entry)}>
                        {busyIds[entry.id] ? 'Saving…' : 'Mark reimbursed'}
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
  fetchedAt,
  refreshing,
  error,
  onRefresh,
  onClose,
}: {
  receipt: SignedReceiptUrlResponse
  fetchedAt: number
  refreshing: boolean
  error: string
  onRefresh: () => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, receipt.expiresIn - Math.floor((Date.now() - fetchedAt) / 1000)))

  useAccessibleModal(true, onClose, panelRef, closeBtnRef)

  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, receipt.expiresIn - Math.floor((Date.now() - fetchedAt) / 1000))
      setRemainingSeconds(next)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [receipt.expiresIn, fetchedAt])

  const safeUrl = safeHttpsHref(receipt.url)
  const expired = remainingSeconds <= 0
  const isHeic = receipt.contentType === 'image/heic'
  const isPdf = receipt.contentType === 'application/pdf'
  const isInlineImage = receipt.contentType.startsWith('image/') && !isHeic

  // Restore focus inside the dialog if a focused Refresh button disappears after refreshing
  useEffect(() => {
    if (!expired && typeof document !== 'undefined' && panelRef.current && !panelRef.current.contains(document.activeElement)) {
      closeBtnRef.current?.focus({ preventScroll: true })
    }
  }, [expired, fetchedAt])

  return (
    <div className="finance-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        className="panel finance-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt: ${receipt.filename}`}
        tabIndex={-1}
      >
        <div className="section-heading">
          <div>
            <h2>{receipt.filename}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {expired
                ? 'Temporary link expired — refresh to generate a new signed link.'
                : `Temporary private link expires in ${remainingSeconds}s · ${receipt.contentType}`}
            </p>
          </div>
          <div className="row-actions">
            {expired && (
              <button type="button" className="btn primary small" disabled={refreshing} onClick={onRefresh}>
                {refreshing ? 'Refreshing…' : 'Refresh link'}
              </button>
            )}
            <button ref={closeBtnRef} type="button" className="btn secondary small" onClick={onClose}>Close</button>
          </div>
        </div>

        {error && <p className="form-error" role="alert" style={{ margin: 0 }}>{error}</p>}

        {!safeUrl ? (
          <p className="form-error" role="alert">Receipt URL failed HTTPS safety validation.</p>
        ) : expired ? (
          <div className="state-card">
            <p>This signed receipt link has expired for security.</p>
            <button type="button" className="btn primary" disabled={refreshing} onClick={onRefresh}>
              {refreshing ? 'Refreshing…' : 'Generate fresh link'}
            </button>
          </div>
        ) : (
          <>
            {isInlineImage && (
              <img
                src={safeUrl}
                alt={receipt.filename}
                referrerPolicy="no-referrer"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '0.75rem' }}
              />
            )}

            {isPdf && (
              <div className="state-card">
                <p>PDF receipts open in a new tab using a short-lived signed link so keyboard focus stays in this dialog and mobile viewers render all pages.</p>
                <a className="btn primary" href={safeUrl} target="_blank" rel="noreferrer">
                  Open PDF in new tab
                </a>
              </div>
            )}

            {isHeic && (
              <div className="state-card">
                <p>HEIC photos cannot be previewed inline in most desktop browsers.</p>
                <a className="btn primary" href={safeUrl} target="_blank" rel="noreferrer">
                  Download HEIC receipt
                </a>
              </div>
            )}

            {isInlineImage && (
              <div className="row-actions">
                <a className="btn secondary small" href={safeUrl} target="_blank" rel="noreferrer">
                  Open in new tab
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
