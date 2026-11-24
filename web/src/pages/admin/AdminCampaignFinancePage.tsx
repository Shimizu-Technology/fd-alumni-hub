import { AdminEditorDialog } from './AdminEditorDialog'
import { LedgerEntryDialog } from './finance/LedgerEntryDialog'
import { LedgerTab } from './finance/LedgerTab'
import { ReimbursementsTab } from './finance/ReimbursementsTab'
import { centsToInput, formatUsd, parseDollarsToCents, todayIsoDate, useAccessibleModal } from './finance/financeFields'
import { hasCapability } from '../../lib/adminModules'
import { AdminConfirmDialog, type ConfirmDialogRequest } from '../../components/admin/AdminConfirmDialog'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref } from '../../lib/urls'
import type {
  AdminHostCampaign,
  BudgetLineRecord,
  FinanceSummary,
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

const FINANCE_TABS = ['ledger', 'budget', 'pledges', 'reimbursements', 'report'] as const
type FinanceTab = typeof FINANCE_TABS[number]

const PLEDGE_TIERS = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Donor', 'In-Kind']
const PLEDGE_STATUSES: PledgeStatus[] = ['promised', 'partial', 'fulfilled', 'cancelled']

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

export function AdminCampaignFinancePage() {
  const auth = useAuthContext()
  const isAdmin = Boolean(auth.user?.isSuperAdmin ?? auth.user?.isAdmin)
  const hasScopedLookup = isAdmin || Boolean(auth.user?.capabilities)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab = FINANCE_TABS.find((section) => section === requestedTab) ?? 'ledger'
  const action = searchParams.get('action')
  const entryType = action === 'income' || action === 'expense' ? action : null
  const [saveNotice, setSaveNotice] = useState<{ slug: string; message: string } | null>(null)

  function setTab(next: FinanceTab, replace = false) {
    setSearchParams({ campaign: selectedSlug, tab: next }, { replace })
  }

  function openEntry(next: LedgerEntryType) {
    setSaveNotice(null)
    setSearchParams({ campaign: selectedSlug, tab, action: next })
  }
  const [entryTypeFilter, setEntryTypeFilter] = useState('')
  const [includeVoided, setIncludeVoided] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [receiptPreview, setReceiptPreview] = useState<{ entryId: string; signed: SignedReceiptUrlResponse; fetchedAt: number } | null>(null)
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState('')

  const adminCampaignsQuery = useAsync(
    () => (hasScopedLookup ? api.adminCampaignWorkspace("finance_and_reimbursements") : Promise.resolve({ campaigns: [] as AdminHostCampaign[] })),
    [hasScopedLookup],
  )

  const campaignOptions = useMemo(() => {
    if (hasScopedLookup && adminCampaignsQuery.data?.campaigns) {
      return adminCampaignsQuery.data.campaigns.map((c) => ({ slug: c.slug, title: c.title, status: c.status }))
    }
    return (auth.user?.campaignMemberships || []).map((m) => ({
      slug: m.campaignSlug,
      title: m.campaignTitle,
      status: m.status,
    }))
  }, [hasScopedLookup, adminCampaignsQuery.data, auth.user?.campaignMemberships])

  const requestedSlug = searchParams.get('campaign')
  const selectedSlug = useMemo(() => {
    if (requestedSlug) return campaignOptions.some((c) => c.slug === requestedSlug) ? requestedSlug : ''
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
    const [budgetSettled, pledgesSettled, reimbSettled] = await Promise.allSettled([
      api.campaignBudgetLines(selectedSlug, { includeArchived: true }),
      api.campaignPledges(selectedSlug),
      api.campaignLedgerEntries(selectedSlug, { entryType: 'expense', includeVoided: false }),
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
    }
  }, [selectedSlug])

  // Filtered ledger query runs independently so changing ledger filters doesn't refetch summary or other finance sections
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

  if (hasScopedLookup && adminCampaignsQuery.loading && !adminCampaignsQuery.data) {
    return <LoadingState label="Loading host campaigns" />
  }

  if (hasScopedLookup && adminCampaignsQuery.error) {
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

  if (requestedSlug && !selectedSlug) {
    return <EmptyState title="Finance access unavailable" description="You do not have access to the selected campaign."
      action={<button className="btn secondary" onClick={() => setSearchParams({})}>Open my finance workspace</button>} />
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
    : null

  const isArchived = campaign.status === 'archived'
  const financePermission = (action: string, legacyAllowed: boolean) => auth.user?.capabilities
    ? hasCapability(auth.user, 'finance_and_reimbursements', action, { type: 'campaign', id: campaign.id })
    : isAdmin || legacyAllowed
  const canWriteFinance = financePermission('record', roles.includes('treasurer')) && !isArchived
  const canApproveReimbursements = financePermission('approve', roles.includes('chair') || roles.includes('treasurer')) && !isArchived
  const canMarkReimbursed = financePermission('payout', roles.includes('treasurer')) && !isArchived
  const canViewAudit = hasCapability(auth.user, 'view_audit_log', 'view', { type: 'campaign', id: campaign.id })
  const canViewReceipts = financePermission('view_receipts', true)

  return (
    <div className="page-stack admin-page finance-page">
      <div className={tab === 'report' ? 'page-stack no-print' : 'page-stack'}>
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
              {financePermission('export', true) && <button
                type="button"
                className="btn secondary"
                title="Downloads the complete campaign ledger (including voided entries) as a CSV file"
                onClick={() => void handleDownloadCsv()}
                disabled={exportingCsv}
              >
                {exportingCsv ? 'Exporting…' : 'Export CSV'}
              </button>}
            </div>
          )}
        />

        <div className="row-actions finance-quick-actions" aria-label="Finance actions">
          {canWriteFinance && (
            <>
              <button type="button" className="btn primary" onClick={() => openEntry('income')}>Record money received</button>
              <button type="button" className="btn secondary" onClick={() => openEntry('expense')}>Record expense</button>
            </>
          )}
          <button type="button" className="btn secondary" onClick={() => setTab('reimbursements')}>
            Reimbursements to review ({summary.pendingReimbursementsCount})
          </button>
          {canViewAudit && <Link className="finance-history-link" to={`/admin/audit?area=finance&hostCampaignId=${encodeURIComponent(campaign.id)}`}>View finance history →</Link>}
        </div>
        {saveNotice?.slug === campaign.slug && <p role="status">{saveNotice.message}</p>}
        {entryType && canWriteFinance && ledgerQuery.error && !ledgerOptions && (
          <ErrorState message={ledgerQuery.error} onRetry={ledgerQuery.reload} />
        )}
        {entryType && canWriteFinance && !ledgerQuery.error && !ledgerOptions && <LoadingState label="Loading entry options" />}
        {entryType && canWriteFinance && ledgerOptions && (
          <LedgerEntryDialog
            key={`${campaign.slug}:${entryType}:${searchParams.get('eventId') || ''}`}
            campaignSlug={campaign.slug}
            entryType={entryType}
            eventId={searchParams.get('eventId')}
            options={ledgerOptions}
            onClose={() => setTab(tab, true)}
            onRecorded={() => {
              setSaveNotice({ slug: campaign.slug, message: entryType === 'income' ? 'Money received recorded.' : 'Expense recorded.' })
              setEntryTypeFilter('')
              setTab('ledger', true)
              void reloadAll()
            }}
          />
        )}
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
              <strong>Viewing finance:</strong> Your access allows you to review the ledger and totals.
              {canApproveReimbursements ? ' You can also approve out-of-pocket reimbursements.' : ''}
            </p>
          </Panel>
        )}

        {summary.mixedNetEventIds.length > 0 && (
          <Panel>
            <p className="form-error" role="status" style={{ margin: 0 }}>
              <strong>Accounting check:</strong> Event(s) #{summary.mixedNetEventIds.join(', #')} combine a net payout entry with separate event expense entries. Review those rows so costs are not counted twice.
            </p>
          </Panel>
        )}

        <div className="stats-grid four">
          <StatCard
            label="Raised"
            value={formatUsd(summary.raisedCents)}
            detail={`of ${formatUsd(summary.goalCents)} goal · ${summary.publicMeterEnabled ? 'Meter ON' : 'Meter hidden'}`}
            tone="gold"
          />
          <StatCard label="Spent" value={formatUsd(summary.spentCents)} detail={`Still needed: ${formatUsd(summary.stillNeededCents)}`} />
          <StatCard label="Net balance" value={formatUsd(summary.netCents)} detail="Available campaign funds" tone="maroon" />
          <StatCard
            label="Pending reimbursements"
            value={summary.pendingReimbursementsCount}
            detail={summary.pendingReimbursementsCents > 0 ? `${formatUsd(summary.pendingReimbursementsCents)} awaiting payout` : 'All caught up'}
          />
        </div>

        <details className="panel finance-breakdown-details">
          <summary>Meter, FDAA &amp; pledge breakdown</summary>
          <div className="stats-grid four" style={{ marginTop: '0.85rem' }}>
            <StatCard
              label="Public meter total"
              value={formatUsd(summary.publicMeterRaisedCents)}
              detail={summary.includeFdaaInPublicMeter ? 'Includes FDAA allocation' : 'Excludes FDAA allocation'}
            />
            <StatCard
              label="Raised (excl. FDAA)"
              value={formatUsd(summary.raisedExcludingFdaaCents)}
              detail="Direct class fundraising"
            />
            <StatCard
              label="Open cash pledges"
              value={formatUsd(summary.outstandingPledgesCents)}
              detail={`Received ${formatUsd(summary.pledgedReceivedCents)} of ${formatUsd(summary.pledgedTotalCents)}`}
            />
            <StatCard
              label="In-kind pledges"
              value={summary.inKindPledgesCount}
              detail="Tracked separately from cash"
            />
          </div>
        </details>

        {canWriteFinance && (
          <FinanceSettingsPanel key={campaign.slug} campaign={campaign} summary={summary} onSaved={reloadAll} />
        )}
      </div>

      <nav className="finance-tabs admin-section-tabs" aria-label="Finance tracker sections">
        <button type="button" aria-current={tab === 'ledger' ? 'page' : undefined} className="admin-module-tab" onClick={() => setTab('ledger')}>
          Ledger ({ledgerEntries.length})
        </button>
        <button type="button" aria-current={tab === 'budget' ? 'page' : undefined} className="admin-module-tab" onClick={() => setTab('budget')}>
          Budget ({summary.budgetVsActual.length})
        </button>
        <button type="button" aria-current={tab === 'pledges' ? 'page' : undefined} className="admin-module-tab" onClick={() => setTab('pledges')}>
          Pledges ({pledges.length})
        </button>
        <button type="button" aria-current={tab === 'reimbursements' ? 'page' : undefined} className="admin-module-tab" onClick={() => setTab('reimbursements')}>
          Reimbursements ({summary.pendingReimbursementsCount})
        </button>
        <button type="button" aria-current={tab === 'report' ? 'page' : undefined} className="admin-module-tab" onClick={() => setTab('report')}>
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
          canWrite={canWriteFinance}
          entryTypeFilter={entryTypeFilter}
          includeVoided={includeVoided}
          onEntryTypeFilter={setEntryTypeFilter}
          onIncludeVoided={setIncludeVoided}
          onOpenReceipt={canViewReceipts ? handleOpenReceipt : undefined}
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
            canApprove={canApproveReimbursements}
            canMarkReimbursed={canMarkReimbursed}
            receiptLoadingId={receiptLoadingId}
            onOpenReceipt={canViewReceipts ? handleOpenReceipt : undefined}
            onSaved={reloadAll}
          />
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
      const isPlainNumber = /^-?\d+(\.\d+)?$/.test(text)
      const safe = !isPlainNumber && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
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
  const [editor, setEditor] = useState<BudgetLineRecord | null>()
  const [error, setError] = useState('')
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null)

  const handleArchive = (line: BudgetLineRecord) => {
    setConfirmRequest({
      title: `Archive "${line.category}"?`,
      message: 'This budget line will be archived. Existing ledger history stays intact.',
      confirmLabel: 'Archive line',
      destructive: true,
      onConfirm: async () => {
        setError('')
        try {
          await api.campaignArchiveBudgetLine(campaign.slug, line.id)
          await onSaved()
        } catch (err) {
          setError(mutationErrorMessage(err, 'Unable to archive budget line'))
        }
      },
    })
  }

  return (
    <div className="page-stack">
      <Panel>
        <div className="section-heading">
          <h2>Budget vs Actual</h2>
          {canWrite && <button type="button" className="btn primary" onClick={() => setEditor(null)}>Add budget line</button>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {summary.budgetVsActual.length === 0 ? (
          <EmptyState title="No budget lines yet" description="Add planned income and expense categories to compare against actual ledger totals." />
        ) : (
          <table className="admin-finance-table" aria-label="Budget vs Actual">
            <thead><tr>
              <th scope="col">Category</th><th scope="col">Budget</th><th scope="col">Actual</th>
              <th scope="col">Variance</th>{canWrite && <th scope="col">Actions</th>}
            </tr></thead>
            <tbody>
              {summary.budgetVsActual.map((row) => {
                const record = budgetLines.find((line) => line.id === row.id)
                const varianceLabel = row.varianceCents === 0
                  ? 'On budget'
                  : row.kind === 'expense'
                    ? (row.varianceCents > 0 ? `${formatUsd(row.varianceCents)} over budget` : `${formatUsd(Math.abs(row.varianceCents))} under budget`)
                    : (row.varianceCents > 0 ? `${formatUsd(row.varianceCents)} above target` : `${formatUsd(Math.abs(row.varianceCents))} below target`)

                return (
                  <tr key={row.id}>
                    <th scope="row">
                      <strong>{row.category}</strong>{' '}
                      <span className="status-badge">{row.kind}</span>{' '}
                      {row.archived && <StatusBadge status="archived" />}
                    </th>
                    <td><span className="admin-finance-cell-label" aria-hidden="true">Budget</span>{formatUsd(row.budgetCents)}</td>
                    <td><span className="admin-finance-cell-label" aria-hidden="true">Actual</span>{formatUsd(row.actualCents)}</td>
                    <td>{varianceLabel}</td>
                    {canWrite && <td>{record && !record.archivedAt && (
                      <div className="row-actions">
                        <button type="button" className="btn secondary small" onClick={() => setEditor(record)}>Edit budget line</button>
                        <button type="button" className="btn secondary small" onClick={() => void handleArchive(record)}>Archive</button>
                      </div>
                    )}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
      {canWrite && editor !== undefined && (
        <BudgetLineDialog campaignSlug={campaign.slug} line={editor} onClose={() => setEditor(undefined)} onSaved={onSaved} />
      )}
      <AdminConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </div>
  )
}

function BudgetLineDialog({ campaignSlug, line, onClose, onSaved }: {
  campaignSlug: string
  line: BudgetLineRecord | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [kind, setKind] = useState<LedgerEntryType>(line?.kind ?? 'expense')
  const [category, setCategory] = useState(line?.category ?? '')
  const [budgetDollars, setBudgetDollars] = useState(line ? centsToInput(line.budgetCents) : '')
  const [notes, setNotes] = useState(line?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const budgetParsed = parseDollarsToCents(budgetDollars)
    if (!budgetParsed.ok) {
      setError(`Planned budget: ${budgetParsed.error}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...(!line && { kind }),
        category: category.trim(),
        budgetCents: budgetParsed.value,
        notes: notes.trim() || null,
      }
      if (line) await api.campaignUpdateBudgetLine(campaignSlug, line.id, payload)
      else await api.campaignCreateBudgetLine(campaignSlug, payload)
      await onSaved()
      onClose()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save budget line'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminEditorDialog title={line ? 'Edit budget line' : 'Add budget line'} onClose={onClose} busy={saving}>
      <form className="stacked-form" onSubmit={handleSave}>
        <FormGrid>
          <Field label="Kind">
            <select disabled={Boolean(line)} value={kind} onChange={(e) => setKind(e.target.value as LedgerEntryType)}>
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
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save budget line'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </AdminEditorDialog>
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
  const [editor, setEditor] = useState<PledgeRecord | null>()
  const [error, setError] = useState('')

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
      <Panel>
        <div className="section-heading">
          <h2>Pledges ({pledges.length})</h2>
          {canWrite && <button type="button" className="btn primary" onClick={() => setEditor(null)}>Add pledge</button>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="muted">Cash pledge fulfillment updates automatically as linked income entries are recorded or voided.</p>
        {pledges.length === 0 ? (
          <EmptyState title="No pledges tracked yet" description="Log promised sponsorships or donations to monitor follow-up and fulfillment." />
        ) : (
          <table className="admin-finance-table" aria-label="Pledges">
            <thead><tr>
              <th scope="col">Donor</th><th scope="col">Promised</th><th scope="col">Received</th>
              <th scope="col">Outstanding</th><th scope="col">Due</th>{canWrite && <th scope="col">Actions</th>}
            </tr></thead>
            <tbody>
              {pledges.map((pledge) => (
                <tr key={pledge.id}>
                  <th scope="row">
                    <strong>{pledge.donorName}</strong>{' '}
                    {pledge.tier && <span className="status-badge">{pledge.tier}</span>}{' '}
                    {pledge.isInKind && <span className="status-badge">In-Kind</span>}{' '}
                    <StatusBadge status={pledge.status} />
                  </th>
                  <td><span className="admin-finance-cell-label" aria-hidden="true">Promised</span>{formatUsd(pledge.promisedCents)}</td>
                  <td>
                    <span className="admin-finance-cell-label" aria-hidden="true">Received</span>
                    {pledge.isInKind ? '—' : formatUsd(pledge.receivedCents)}
                    {!pledge.isInKind && pledge.overpaymentCents > 0 && <small>Overpaid +{formatUsd(pledge.overpaymentCents)}</small>}
                  </td>
                  <td><span className="admin-finance-cell-label" aria-hidden="true">Outstanding</span>{pledge.isInKind ? '—' : formatUsd(pledge.outstandingCents)}</td>
                  <td><span className="admin-finance-cell-label" aria-hidden="true">Due</span>{pledge.dueOn || '—'}</td>
                  {canWrite && <td><div className="row-actions">
                    <button type="button" className="btn secondary small" onClick={() => setEditor(pledge)}>Edit pledge</button>
                    {pledge.isInKind ? (
                      <select aria-label={`Status for ${pledge.donorName}`} value={pledge.status} onChange={(e) => void handleStatusChange(pledge.id, e.target.value as PledgeStatus)}>
                        {PLEDGE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    ) : pledge.status === 'cancelled' ? (
                      <button type="button" className="btn secondary small" onClick={() => void handleStatusChange(pledge.id, 'promised')}>Reopen pledge</button>
                    ) : pledge.receivedCents === 0 ? (
                      <button type="button" className="btn secondary small" onClick={() => void handleStatusChange(pledge.id, 'cancelled')}>Cancel pledge</button>
                    ) : (
                      <small>Auto-synced</small>
                    )}
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {canWrite && editor !== undefined && (
        <PledgeDialog campaignSlug={campaign.slug} pledge={editor} sponsors={sponsors} onClose={() => setEditor(undefined)} onSaved={onSaved} />
      )}
    </div>
  )
}

function PledgeDialog({ campaignSlug, pledge, sponsors, onClose, onSaved }: {
  campaignSlug: string
  pledge: PledgeRecord | null
  sponsors: Array<{ id: string; name: string }>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [donorName, setDonorName] = useState(pledge?.donorName ?? '')
  const [sponsorId, setSponsorId] = useState(pledge?.sponsorId ?? '')
  const [contactInfo, setContactInfo] = useState(pledge?.contactInfo ?? '')
  const [tier, setTier] = useState(pledge ? pledge.tier ?? '' : 'Gold')
  const [isInKind, setIsInKind] = useState(pledge?.isInKind ?? false)
  const [promisedDollars, setPromisedDollars] = useState(pledge ? centsToInput(pledge.promisedCents) : '')
  const [dueOn, setDueOn] = useState(pledge?.dueOn ?? '')
  const [notes, setNotes] = useState(pledge?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const promisedParsed = parseDollarsToCents(promisedDollars, { positive: true })
    if (!promisedParsed.ok) {
      setError(`Promised amount: ${promisedParsed.error}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        donorName: donorName.trim(),
        sponsorId: sponsorId || null,
        contactInfo: contactInfo.trim() || null,
        tier: tier || null,
        ...(!pledge && { isInKind }),
        promisedCents: promisedParsed.value,
        dueOn: dueOn || null,
        notes: notes.trim() || null,
      }
      if (pledge) await api.campaignUpdatePledge(campaignSlug, pledge.id, payload)
      else await api.campaignCreatePledge(campaignSlug, payload)
      await onSaved()
      onClose()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save pledge'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminEditorDialog title={pledge ? 'Edit pledge' : 'Add pledge'} onClose={onClose} busy={saving}>
      <form className="stacked-form" onSubmit={handleSave}>
        <FormGrid>
          <Field label="Donor / Sponsor name">
            <input value={donorName} onChange={(e) => setDonorName(e.target.value)} required placeholder="Bank of Guam" />
          </Field>
          <Field label="Linked tournament sponsor (optional)">
            <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)}>
              <option value="">None</option>
              {sponsorId && !sponsors.some((sponsor) => sponsor.id === sponsorId) && <option value={sponsorId}>{pledge?.sponsorName || 'Current sponsor'}</option>}
              {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Promised amount / value (USD)">
            <input inputMode="decimal" value={promisedDollars} onChange={(e) => setPromisedDollars(e.target.value)} required placeholder="2500" />
          </Field>
          <Field label="Tier">
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">No tier</option>
              {tier && !PLEDGE_TIERS.includes(tier) && <option value={tier}>{tier}</option>}
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
          <input type="checkbox" checked={isInKind} disabled={Boolean(pledge)} onChange={(e) => setIsInKind(e.target.checked)} />
          <span>In-kind donation (tracked separately from cash totals)</span>
        </label>
        <div className="row-actions" style={{ marginTop: '0.75rem' }}>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save pledge'}</button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </AdminEditorDialog>
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
