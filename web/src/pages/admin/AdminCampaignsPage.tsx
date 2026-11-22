import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { AdminHostCampaign, CampaignCloseoutCheck, HostCampaignStatus } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const EDITABLE_CAMPAIGN_STATUSES: HostCampaignStatus[] = ['draft', 'active', 'closing']

function centsToDollars(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return '0'
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

function parseDollarsToCents(raw: string, { positive = false }: { positive?: boolean } = {}): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/[$,\s]/g, '')
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a valid dollar amount (for example, 30000 or 15000.00).' }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || (positive ? parsed <= 0 : parsed < 0)) {
    return { ok: false, error: positive ? 'Amount must be greater than $0.' : 'Amount cannot be negative.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

function parsePercentToBps(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/[%\s]/g, '')
  if (!trimmed || !/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a valid percentage between 0 and 100.' }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return { ok: false, error: 'Ticket share percentage must be between 0 and 100.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100)
}

export function AdminCampaignsPage() {
  const { user } = useAuthContext()
  return (user?.isSuperAdmin ?? user?.isAdmin) ? <CampaignAdministration /> : <ScopedCampaignDirectory />
}

function ScopedCampaignDirectory() {
  const query = useAsync(() => api.adminCampaignWorkspace('fundraisers_and_sponsors'), [])
  if (query.loading) return <LoadingState label="Loading campaigns" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />
  const campaigns = query.data?.campaigns ?? []
  return <div className="page-stack">
    <PageHeader title="Campaigns" />
    {campaigns.length === 0 && <EmptyState title="No campaigns in your workspace" />}
    {campaigns.map((campaign) => <Panel key={campaign.id}>
      <Link to={`/admin/campaign/host-year?campaign=${encodeURIComponent(campaign.slug)}`}>{campaign.title}</Link>
    </Panel>)}
  </div>
}

function CampaignAdministration() {
  const query = useAsync(async () => {
    const [campaignsRes, tournamentsRes, cohortsRes] = await Promise.all([
      api.adminCampaigns(),
      api.adminTournaments(),
      api.adminClassCohorts(),
    ])
    return {
      campaigns: campaignsRes.campaigns,
      tournaments: tournamentsRes.tournaments,
      cohorts: cohortsRes.classCohorts,
    }
  }, [])

  const [editing, setEditing] = useState<AdminHostCampaign | null>(null)
  const [tournamentId, setTournamentId] = useState('')
  const [classCohortId, setClassCohortId] = useState('')
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [tagline, setTagline] = useState('')
  const [status, setStatus] = useState<HostCampaignStatus>('draft')
  const [featured, setFeatured] = useState(false)
  const [goalDollars, setGoalDollars] = useState('30000')
  const [fdaaUpfrontDollars, setFdaaUpfrontDollars] = useState('15000')
  const [fdaaSharePercent, setFdaaSharePercent] = useState('50')
  const [publicMeterEnabled, setPublicMeterEnabled] = useState(false)
  const [includeFdaaInPublicMeter, setIncludeFdaaInPublicMeter] = useState(false)
  const [donationUrl, setDonationUrl] = useState('')
  const [donationInstructions, setDonationInstructions] = useState('')
  const [golfUrl, setGolfUrl] = useState('')
  const [hafapassOrganizerSlug, setHafapassOrganizerSlug] = useState('')
  const [hafapassTournamentOrganizerSlug, setHafapassTournamentOrganizerSlug] = useState('')
  const [hafapassDistributionCode, setHafapassDistributionCode] = useState('')
  const [breakGlassReason, setBreakGlassReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [archiveTarget, setArchiveTarget] = useState<AdminHostCampaign | null>(null)
  const [closeoutCheck, setCloseoutCheck] = useState<CampaignCloseoutCheck | null>(null)
  const [closeoutLoading, setCloseoutLoading] = useState(false)
  const [archiveForceReason, setArchiveForceReason] = useState('')
  const [archiveCompleteTournament, setArchiveCompleteTournament] = useState(true)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [cloneSource, setCloneSource] = useState<AdminHostCampaign | null>(null)
  const [cloneUseExistingTournament, setCloneUseExistingTournament] = useState(false)
  const [cloneTargetTournamentId, setCloneTargetTournamentId] = useState('')
  const [cloneNewYear, setCloneNewYear] = useState('')
  const [cloneNewName, setCloneNewName] = useState('')
  const [cloneStartDate, setCloneStartDate] = useState('')
  const [cloneEndDate, setCloneEndDate] = useState('')
  const [cloneHostClassYear, setCloneHostClassYear] = useState('')
  const [cloneTitle, setCloneTitle] = useState('')
  const [cloneSlug, setCloneSlug] = useState('')
  const [cloneGoalDollars, setCloneGoalDollars] = useState('30000')
  const [copyDivisions, setCopyDivisions] = useState(true)
  const [copyBudgetCategories, setCopyBudgetCategories] = useState(true)
  const [copyBudgetAmounts, setCopyBudgetAmounts] = useState(false)
  const [copyEventTemplates, setCopyEventTemplates] = useState(true)
  const [cloneBusy, setCloneBusy] = useState(false)
  const [cloneError, setCloneError] = useState('')
  const closeoutReqIdRef = useRef(0)

  const openArchivePanel = async (c: AdminHostCampaign) => {
    const reqId = ++closeoutReqIdRef.current
    setArchiveTarget(c)
    setCloseoutCheck(null)
    setArchiveForceReason('')
    setArchiveCompleteTournament(true)
    setArchiveError('')
    setCloseoutLoading(true)
    try {
      const check = await api.adminCampaignCloseoutCheck(c.id)
      if (closeoutReqIdRef.current !== reqId) return
      setCloseoutCheck(check)
    } catch (err) {
      if (closeoutReqIdRef.current !== reqId) return
      setArchiveError(mutationErrorMessage(err, 'Unable to load close-out checklist'))
    } finally {
      if (closeoutReqIdRef.current === reqId) setCloseoutLoading(false)
    }
  }

  const submitArchive = async (event: FormEvent) => {
    event.preventDefault()
    if (!archiveTarget) return
    const targetId = archiveTarget.id
    setArchiveBusy(true)
    setArchiveError('')
    try {
      await api.adminArchiveCampaign(targetId, {
        forceReason: archiveForceReason.trim() || null,
        completeTournament: archiveCompleteTournament,
      })
      setMessage(`Archived campaign "${archiveTarget.title}".`)
      setArchiveTarget(null)
      setCloseoutCheck(null)
      await query.reload()
    } catch (err) {
      setArchiveError(mutationErrorMessage(err, 'Unable to archive campaign'))
      try {
        const freshCheck = await api.adminCampaignCloseoutCheck(targetId)
        setCloseoutCheck(freshCheck)
      } catch {
        // Keep the existing checklist if refresh fails.
      }
    } finally {
      setArchiveBusy(false)
    }
  }

  const openClonePanel = (c: AdminHostCampaign) => {
    const nextYear = (c.tournament?.year || new Date().getFullYear()) + 1
    const nextHostYear = (c.hostClass?.graduationYear || (nextYear - 10)) + 1
    const occupiedTournamentIds = new Set((query.data?.campaigns || []).map((cm) => cm.tournamentId))
    const availableTournaments = (query.data?.tournaments || []).filter(
      (t) => t.id !== c.tournamentId && !occupiedTournamentIds.has(t.id),
    )
    const existingNextYear = availableTournaments.find((t) => t.year === nextYear)

    setCloneSource(c)
    setCloneUseExistingTournament(Boolean(existingNextYear))
    setCloneTargetTournamentId(existingNextYear?.id || '')
    setCloneNewYear(String(nextYear))
    setCloneNewName(`FD Alumni Basketball Tournament ${nextYear}`)
    setCloneStartDate(`${nextYear}-06-25`)
    setCloneEndDate(`${nextYear}-07-16`)
    setCloneHostClassYear(String(nextHostYear))
    setCloneTitle(`Class of ${nextHostYear} Host Year`)
    setCloneSlug(`${nextYear}-class-of-${nextHostYear}`)
    setCloneGoalDollars(centsToDollars(c.goalCents))
    setCopyDivisions(true)
    setCopyBudgetCategories(true)
    setCopyBudgetAmounts(false)
    setCopyEventTemplates(true)
    setCloneError('')
  }

  const submitClone = async (event: FormEvent) => {
    event.preventDefault()
    if (!cloneSource) return
    const goalParsed = parseDollarsToCents(cloneGoalDollars, { positive: true })
    if (!goalParsed.ok) {
      setCloneError(`Goal: ${goalParsed.error}`)
      return
    }
    const hostYearNum = Number(cloneHostClassYear)
    if (!Number.isInteger(hostYearNum) || hostYearNum < 1950 || hostYearNum > 2099) {
      setCloneError('Enter a valid host class graduation year (1950–2099).')
      return
    }

    setCloneBusy(true)
    setCloneError('')
    try {
      const res = await api.adminCloneCampaign(cloneSource.id, {
        targetTournamentId: cloneUseExistingTournament ? cloneTargetTournamentId : null,
        tournament: cloneUseExistingTournament
          ? null
          : {
              name: cloneNewName.trim(),
              year: Number(cloneNewYear),
              startDate: cloneStartDate,
              endDate: cloneEndDate,
              status: 'upcoming',
            },
        hostClassYear: hostYearNum,
        title: cloneTitle.trim() || null,
        slug: cloneSlug.trim().toLowerCase() || null,
        goalCents: goalParsed.value,
        copyDivisions,
        copyBudgetCategories,
        copyBudgetAmounts,
        copyEventTemplates,
      })
      setMessage(`Cloned draft campaign "${res.campaign.title}" (${res.campaign.slug}) with ${res.divisions.length} divisions, ${res.budgetLinesCount} budget categories, and ${res.campaignEventsCount} event templates.`)
      setCloneSource(null)
      await query.reload()
    } catch (err) {
      setCloneError(mutationErrorMessage(err, 'Unable to clone campaign'))
    } finally {
      setCloneBusy(false)
    }
  }

  const resetForm = () => {
    setEditing(null)
    setTournamentId('')
    setClassCohortId('')
    setSlug('')
    setTitle('')
    setTagline('')
    setStatus('draft')
    setFeatured(false)
    setGoalDollars('30000')
    setFdaaUpfrontDollars('15000')
    setFdaaSharePercent('50')
    setPublicMeterEnabled(false)
    setIncludeFdaaInPublicMeter(false)
    setDonationUrl('')
    setDonationInstructions('')
    setGolfUrl('')
    setHafapassOrganizerSlug('')
    setHafapassTournamentOrganizerSlug('')
    setHafapassDistributionCode('')
    setBreakGlassReason('')
  }

  const startEdit = (c: AdminHostCampaign) => {
    setEditing(c)
    setTournamentId(c.tournamentId)
    setClassCohortId(c.classCohortId)
    setSlug(c.slug)
    setTitle(c.title)
    setTagline(c.tagline || '')
    setStatus(c.status)
    setFeatured(c.featured)
    setGoalDollars(centsToDollars(c.goalCents))
    setFdaaUpfrontDollars(centsToDollars(c.fdaaUpfrontCents))
    setFdaaSharePercent(String((c.fdaaTicketShareBps / 100).toFixed(c.fdaaTicketShareBps % 100 === 0 ? 0 : 2)))
    setPublicMeterEnabled(c.publicMeterEnabled)
    setIncludeFdaaInPublicMeter(c.includeFdaaInPublicMeter)
    setDonationUrl(c.donationUrl || '')
    setDonationInstructions(c.donationInstructions || '')
    setGolfUrl(c.golfUrl || '')
    setHafapassOrganizerSlug(c.hafapassOrganizerSlug || '')
    setHafapassTournamentOrganizerSlug(c.hafapassTournamentOrganizerSlug || '')
    setHafapassDistributionCode(c.hafapassDistributionCode || '')
    setBreakGlassReason('')
    setMessage('')
    setError('')
  }

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
      const basePayload = {
        title: title.trim(),
        tagline: tagline.trim() || null,
        status,
        featured,
        goalCents: goalParsed.value,
        fdaaUpfrontCents: upfrontParsed.value,
        fdaaTicketShareBps: shareParsed.value,
        publicMeterEnabled,
        includeFdaaInPublicMeter,
        donationUrl: donationUrl.trim() || null,
        donationInstructions: donationInstructions.trim() || null,
        golfUrl: golfUrl.trim() || null,
        hafapassOrganizerSlug: hafapassOrganizerSlug.trim().toLowerCase() || null,
        hafapassTournamentOrganizerSlug: hafapassTournamentOrganizerSlug.trim().toLowerCase() || null,
        hafapassDistributionCode: hafapassDistributionCode.trim().toLowerCase() || null,
      }

      if (editing) {
        await api.adminUpdateCampaign(editing.id, basePayload, editing.status === 'archived' ? breakGlassReason.trim() : null)
        setMessage(`Updated campaign "${basePayload.title}".`)
      } else {
        await api.adminCreateCampaign({
          ...basePayload,
          slug: slug.trim().toLowerCase(),
          tournamentId,
          classCohortId,
        })
        setMessage(`Created campaign "${basePayload.title}".`)
      }
      resetForm()
      await query.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save campaign'))
    } finally {
      setSaving(false)
    }
  }

  if (query.loading && !query.data) return <LoadingState label="Loading host campaigns" />
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />

  const campaigns = query.data?.campaigns || []
  const tournaments = query.data?.tournaments || []
  const cohorts = query.data?.cohorts || []

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="System · Admin only"
        title="Host Year campaigns"
        description="Create multi-year host class campaigns, manage lifecycle & featured status, configure donation channels, and set fundraising targets."
      />

      <Panel>
        <div className="section-heading">
          <h2>{editing ? `Edit campaign: ${editing.title}` : 'Create host campaign'}</h2>
          {editing && <button type="button" className="btn secondary small" onClick={resetForm}>Cancel edit</button>}
        </div>

        <form onSubmit={handleSubmit}>
          <FormGrid>
            <Field label="Tournament year">
              <select value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} required disabled={Boolean(editing)}>
                <option value="">Select tournament…</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.year} — {t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Host class cohort">
              <select value={classCohortId} onChange={(e) => setClassCohortId(e.target.value)} required disabled={Boolean(editing)}>
                <option value="">Select class…</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName} ({c.graduationYear})</option>
                ))}
              </select>
            </Field>
            <Field label="URL slug">
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required disabled={Boolean(editing)} placeholder="2027-class-of-2017" />
            </Field>
            <Field label="Campaign title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Class of 2017 Host Year" />
            </Field>
            <Field label="Tagline">
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Road to the 2027 FD Alumni Tournament" />
            </Field>
            <Field label="Lifecycle status">
              <select value={status} onChange={(e) => setStatus(e.target.value as HostCampaignStatus)}>
                {(editing?.status === 'archived' ? [...EDITABLE_CAMPAIGN_STATUSES, 'archived' as const] : EDITABLE_CAMPAIGN_STATUSES).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Fundraising goal (USD)">
              <input value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} required />
            </Field>
            <Field label="FDAA upfront allocation (USD)">
              <input value={fdaaUpfrontDollars} onChange={(e) => setFdaaUpfrontDollars(e.target.value)} />
            </Field>
            <Field label="FDAA ticket share (%)">
              <input value={fdaaSharePercent} onChange={(e) => setFdaaSharePercent(e.target.value)} />
            </Field>
            <Field label="Donation URL (admin-only https://)">
              <input type="url" value={donationUrl} onChange={(e) => setDonationUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Golf URL (https://)">
              <input type="url" value={golfUrl} onChange={(e) => setGolfUrl(e.target.value)} placeholder="https://fd-golf.shimizu-technology.com" />
            </Field>
            <Field label="HåfaPass host organizer slug">
              <input value={hafapassOrganizerSlug} onChange={(e) => setHafapassOrganizerSlug(e.target.value)} placeholder="co2017" />
            </Field>
            <Field label="HåfaPass tournament organizer slug">
              <input value={hafapassTournamentOrganizerSlug} onChange={(e) => setHafapassTournamentOrganizerSlug(e.target.value)} placeholder="fdaa" />
            </Field>
            <Field label="HåfaPass default distribution code">
              <input value={hafapassDistributionCode} onChange={(e) => setHafapassDistributionCode(e.target.value)} placeholder="co2017-hub" />
            </Field>
          </FormGrid>

          <Field label="Donation instructions (checks / Zelle / 501(c)(3) notes)">
            <textarea rows={3} value={donationInstructions} onChange={(e) => setDonationInstructions(e.target.value)} />
          </Field>

          <div className="row-actions" style={{ marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <span>Featured on Home &amp; /host-year (requires active or closing)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={publicMeterEnabled} onChange={(e) => setPublicMeterEnabled(e.target.checked)} />
              <span>Show public fundraising meter</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={includeFdaaInPublicMeter} onChange={(e) => setIncludeFdaaInPublicMeter(e.target.checked)} />
              <span>Include FDAA upfront/ticket share in public meter</span>
            </label>
          </div>

          {editing?.status === 'archived' && (
            <div style={{ marginTop: '0.75rem' }}>
              <Field label="Break-glass audit reason (required to edit archived campaign)">
                <input value={breakGlassReason} onChange={(e) => setBreakGlassReason(e.target.value)} required placeholder="Explain why this archived record is being updated" />
              </Field>
            </div>
          )}

          <div className="row-actions" style={{ marginTop: '0.85rem' }}>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save campaign' : 'Create campaign'}
            </button>
          </div>
          {message && <p role="status" style={{ marginTop: '0.6rem' }}>{message}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </Panel>

      <Panel>
        <div className="section-heading">
          <h2>All host campaigns ({campaigns.length})</h2>
        </div>
        {campaigns.length === 0 ? (
          <EmptyState title="No host campaigns yet" description="Create your first host campaign above (for example, 2027 Class of 2017)." />
        ) : (
          <div className="admin-list">
            {campaigns.map((c) => (
              <div key={c.id} className="compact-admin-row" style={{ padding: '0.85rem', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{c.title}</strong>{' '}
                  <StatusBadge status={c.status} />{' '}
                  {c.featured && <span className="pill">Featured</span>}
                  <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                    <code>/host-year/{c.slug}</code> · Goal {formatUsd(c.goalCents)} · Meter {c.publicMeterEnabled ? 'Public' : 'Hidden'}
                  </p>
                </div>
                <div className="row-actions">
                  <Link className="btn secondary small" to={`/admin/campaign/finance?campaign=${encodeURIComponent(c.slug)}`}>
                    Finance
                  </Link>
                  <Link className="btn secondary small" to={`/admin/campaign/host-year?campaign=${encodeURIComponent(c.slug)}`}>
                    Content
                  </Link>
                  <button type="button" className="btn secondary small" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  {c.status !== 'archived' && (
                    <button type="button" className="btn secondary small" onClick={() => void openArchivePanel(c)}>
                      Close-Out &amp; Archive
                    </button>
                  )}
                  <button type="button" className="btn primary small" onClick={() => openClonePanel(c)}>
                    Clone for Next Year
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {archiveTarget && (
        <Panel className="closeout-action-panel">
          <div className="section-heading">
            <h2>Close-Out &amp; Archive — {archiveTarget.title}</h2>
            <button type="button" className="btn secondary small" onClick={() => setArchiveTarget(null)}>Cancel</button>
          </div>

          {closeoutLoading ? (
            <LoadingState label="Running close-out checks" />
          ) : closeoutCheck ? (
            <form onSubmit={submitArchive}>
              <div className="stats-grid four">
                <div className="stat-card"><span>Unfinalized games</span><strong>{closeoutCheck.unfinalizedGamesCount}</strong></div>
                <div className="stat-card"><span>Pending reimbursements</span><strong>{closeoutCheck.pendingReimbursementsCount}</strong></div>
                <div className="stat-card"><span>Missing receipts</span><strong>{closeoutCheck.missingReceiptsCount}</strong></div>
                <div className="stat-card"><span>Open cash pledges</span><strong>{closeoutCheck.openCashPledgesCount}</strong></div>
              </div>

              {closeoutCheck.blockers.length > 0 && (
                <div className="scorekeeper-error-box" style={{ marginTop: '0.75rem' }} role="alert">
                  <strong>Close-out blockers ({closeoutCheck.blockers.length})</strong>
                  <ul>{closeoutCheck.blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
                </div>
              )}

              {closeoutCheck.warnings.length > 0 && (
                <div className="panel tickets-stale-banner" style={{ marginTop: '0.75rem' }}>
                  <div>
                    <strong>Warnings</strong>
                    <ul>{closeoutCheck.warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.65rem' }}>
                <label className="check-field">
                  <input type="checkbox" checked={archiveCompleteTournament} onChange={(e) => setArchiveCompleteTournament(e.target.checked)} />
                  Also mark tournament as completed
                </label>

                {closeoutCheck.blockers.length > 0 && (
                  <Field label="Audited override reason (required to archive with open blockers)">
                    <input
                      value={archiveForceReason}
                      onChange={(e) => setArchiveForceReason(e.target.value)}
                      required
                      placeholder="Explain why blockers are being overridden"
                    />
                  </Field>
                )}
              </div>

              {archiveError && <p className="form-error" role="alert">{archiveError}</p>}

              <div className="row-actions" style={{ marginTop: '0.85rem' }}>
                <button type="submit" className="btn danger" disabled={archiveBusy}>
                  {archiveBusy ? 'Archiving…' : 'Confirm Archive Campaign'}
                </button>
              </div>
            </form>
          ) : (
            archiveError && <p className="form-error" role="alert">{archiveError}</p>
          )}
        </Panel>
      )}

      {cloneSource && (
        <Panel className="closeout-action-panel">
          <div className="section-heading">
            <h2>Clone for Next Host Class — from {cloneSource.title}</h2>
            <button type="button" className="btn secondary small" onClick={() => setCloneSource(null)}>Cancel</button>
          </div>
          <p className="muted">
            Creates a fresh <code>draft</code> campaign with strict cross-year isolation: carries over only FDAA upfront/share defaults and optional templates. Never copies ledger entries, receipts, pledges, audit logs, donation/HåfaPass URLs, or board memberships.
          </p>

          <form onSubmit={submitClone}>
            <label className="check-field" style={{ marginBottom: '0.65rem' }}>
              <input type="checkbox" checked={cloneUseExistingTournament} onChange={(e) => setCloneUseExistingTournament(e.target.checked)} />
              Attach to an existing tournament instead of creating a new tournament
            </label>

            <FormGrid>
              {cloneUseExistingTournament ? (
                <Field label="Target tournament">
                  <select value={cloneTargetTournamentId} onChange={(e) => setCloneTargetTournamentId(e.target.value)} required>
                    <option value="">Select unoccupied tournament…</option>
                    {tournaments
                      .filter((t) => t.id !== cloneSource.tournamentId && !campaigns.some((cm) => cm.tournamentId === t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.year} — {t.name} ({t.status})</option>
                      ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="New tournament year"><input type="number" value={cloneNewYear} onChange={(e) => setCloneNewYear(e.target.value)} required /></Field>
                  <Field label="New tournament name"><input value={cloneNewName} onChange={(e) => setCloneNewName(e.target.value)} required /></Field>
                  <Field label="Start date"><input type="date" value={cloneStartDate} onChange={(e) => setCloneStartDate(e.target.value)} required /></Field>
                  <Field label="End date"><input type="date" value={cloneEndDate} onChange={(e) => setCloneEndDate(e.target.value)} required /></Field>
                </>
              )}
              <Field label="Next host class year"><input type="number" value={cloneHostClassYear} onChange={(e) => setCloneHostClassYear(e.target.value)} required /></Field>
              <Field label="New campaign title"><input value={cloneTitle} onChange={(e) => setCloneTitle(e.target.value)} required /></Field>
              <Field label="New campaign slug"><input value={cloneSlug} onChange={(e) => setCloneSlug(e.target.value)} required /></Field>
              <Field label="Fundraising goal (USD)"><input value={cloneGoalDollars} onChange={(e) => setCloneGoalDollars(e.target.value)} required /></Field>
            </FormGrid>

            <div className="row-actions" style={{ marginTop: '0.65rem', flexWrap: 'wrap' }}>
              <label className="check-field"><input type="checkbox" checked={copyDivisions} onChange={(e) => setCopyDivisions(e.target.checked)} /> Copy active divisions</label>
              <label className="check-field"><input type="checkbox" checked={copyBudgetCategories} onChange={(e) => setCopyBudgetCategories(e.target.checked)} /> Copy budget categories</label>
              <label className="check-field"><input type="checkbox" checked={copyBudgetAmounts} onChange={(e) => setCopyBudgetAmounts(e.target.checked)} disabled={!copyBudgetCategories} /> Copy budget dollar amounts</label>
              <label className="check-field"><input type="checkbox" checked={copyEventTemplates} onChange={(e) => setCopyEventTemplates(e.target.checked)} /> Copy event templates (TBD, hidden, no URLs)</label>
            </div>

            {cloneError && <p className="form-error" role="alert">{cloneError}</p>}

            <div className="row-actions" style={{ marginTop: '0.85rem' }}>
              <button type="submit" className="btn primary" disabled={cloneBusy}>
                {cloneBusy ? 'Cloning…' : 'Create Cloned Draft Campaign'}
              </button>
            </div>
          </form>
        </Panel>
      )}
    </div>
  )
}
