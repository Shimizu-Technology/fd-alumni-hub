import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { AdminHostCampaign, HostCampaignStatus } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const CAMPAIGN_STATUSES: HostCampaignStatus[] = ['draft', 'active', 'closing', 'archived']

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
                {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                  <Link className="btn secondary small" to={`/admin/campaign/host-year?campaign=${encodeURIComponent(c.slug)}`}>
                    Content
                  </Link>
                  <button type="button" className="btn secondary small" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
