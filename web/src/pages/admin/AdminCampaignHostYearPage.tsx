import { hasCapability } from '../../lib/adminModules'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { safeHttpsHref } from '../../lib/urls'
import { WEB_IMAGE_UPLOAD_ACCEPT, uploadCampaignImage } from '../../lib/uploads'
import type {
  AdminCampaignEvent,
  AdminCampaignPost,
  AdminHostCampaign,
  CampaignEventKind,
  CampaignEventStatus,
  RecapPhoto,
} from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

import { AdminEditorDialog } from './AdminEditorDialog'
import { AdminConfirmDialog, type ConfirmDialogRequest } from '../../components/admin/AdminConfirmDialog'
import { CampaignHandoff } from './handoff/CampaignHandoff'

const WORKSPACE_TABS = ['settings', 'events', 'posts', 'handoff'] as const
type WorkspaceTab = typeof WORKSPACE_TABS[number]

const EVENT_KINDS: Array<{ value: CampaignEventKind; label: string }> = [
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'host_night', label: 'Host Night' },
  { value: 'golf', label: 'Alumni Golf' },
  { value: 'merch_drop', label: 'Merch Drop' },
  { value: 'meeting', label: 'Board / Class Meeting' },
  { value: 'other', label: 'Other' },
]

const EVENT_STATUSES: CampaignEventStatus[] = ['planned', 'open', 'sold_out', 'completed', 'cancelled']

function toDatetimeLocalValue(iso: string | null | undefined) {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset() * 60_000
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(localValue: string) {
  const trimmed = localValue.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function centsToDollarsInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

function parseOptionalDollarsToCents(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/[$,\s]/g, '')
  if (!trimmed) return { ok: true, value: null }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: 'Enter a valid non-negative dollar amount (for example, 5000 or 2500.50).' }
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: 'Enter a valid non-negative dollar amount.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

export function AdminCampaignHostYearPage() {
  const auth = useAuthContext()
  const isAdmin = Boolean(auth.user?.isSuperAdmin ?? auth.user?.isAdmin)
  const hasCampaignAccess = auth.user?.capabilities?.some((entry) =>
    entry.capability === 'fundraisers_and_sponsors' && (entry.allScopes || entry.scopeType === 'campaign'))
  const hasScopedLookup = isAdmin || Boolean(hasCampaignAccess)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const tab = WORKSPACE_TABS.find((value) => value === requestedTab) ?? 'events'

  function setTab(next: WorkspaceTab, prepare = false) {
    setSearchParams({ campaign: selectedSlug, tab: next, ...(prepare ? { action: 'prepare' } : {}) })
  }
  const [includeArchived, setIncludeArchived] = useState(false)

  const adminCampaignsQuery = useAsync(
    () => (hasScopedLookup ? api.adminCampaignWorkspace("fundraisers_and_sponsors") : Promise.resolve({ campaigns: [] as AdminHostCampaign[] })),
    [hasScopedLookup],
  )

  const campaignOptions = useMemo(() => {
    if (hasScopedLookup && adminCampaignsQuery.data?.campaigns) {
      return adminCampaignsQuery.data.campaigns.map((c) => ({
        slug: c.slug,
        title: c.title,
        status: c.status,
      }))
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

  const workspaceQuery = useAsync(
    async () => {
      if (!selectedSlug) return null
      const [settingsRes, eventsRes, postsRes] = await Promise.all([
        api.campaignSettings(selectedSlug),
        api.campaignEvents(selectedSlug, { includeArchived }),
        api.campaignPosts(selectedSlug),
      ])
      return {
        campaign: settingsRes.campaign,
        roles: settingsRes.roles,
        canManageDonationLinks: settingsRes.canManageDonationLinks,
        events: eventsRes.events,
        posts: postsRes.posts,
      }
    },
    [selectedSlug, includeArchived],
  )

  if (hasScopedLookup && adminCampaignsQuery.loading && !adminCampaignsQuery.data) {
    return <LoadingState label="Loading host campaigns" />
  }

  if (hasScopedLookup && adminCampaignsQuery.error) {
    return <ErrorState message={adminCampaignsQuery.error} onRetry={adminCampaignsQuery.reload} />
  }

  if (campaignOptions.length === 0) {
    return (
      <div className="page-stack admin-page">
        <PageHeader
          eyebrow="Host Year"
          title="Host Year workspace"
          description="Manage your host class tagline, countdown, fundraiser calendar, HåfaPass event links, and class updates."
        />
        <EmptyState
          title="No host campaigns available yet"
          description={isAdmin ? 'Create a host campaign in System → Campaigns to start managing Host Year content.' : 'Ask an administrator to assign your account to a host campaign.'}
          action={isAdmin ? <Link className="btn primary" to="/admin/campaigns">Create a campaign</Link>
            : !hasCampaignAccess && auth.user?.capabilities?.some((entry) => entry.capability === 'fundraisers_and_sponsors' && entry.scopeType === 'tournament')
              ? <Link className="btn primary" to="/admin/sponsors">Open sponsors</Link> : undefined}
        />
      </div>
    )
  }

  if (requestedSlug && !selectedSlug) {
    return <EmptyState title="Host Year access unavailable" description="You do not have access to the selected campaign."
      action={<button className="btn secondary" onClick={() => setSearchParams({})}>Open my Host Year workspace</button>} />
  }

  if (workspaceQuery.loading && (!workspaceQuery.data || workspaceQuery.data.campaign.slug !== selectedSlug)) {
    return <LoadingState label="Loading host year content" />
  }

  if (workspaceQuery.error) {
    return <ErrorState message={workspaceQuery.error} onRetry={workspaceQuery.reload} />
  }

  const campaign = workspaceQuery.data?.campaign
  const roles = workspaceQuery.data?.roles || []
  const events = workspaceQuery.data?.events || []
  const posts = workspaceQuery.data?.posts || []

  if (!campaign) return null

  const isArchived = campaign.status === 'archived'
  const isDraft = campaign.status === 'draft'
  const canRecordFinance = (auth.user?.capabilities
    ? hasCapability(auth.user, 'finance_and_reimbursements', 'view', { type: 'campaign', id: campaign.id }) &&
      hasCapability(auth.user, 'finance_and_reimbursements', 'record', { type: 'campaign', id: campaign.id })
    : isAdmin || roles.includes('treasurer')) && !isArchived
  const canManageDonationLinks = (isAdmin || workspaceQuery.data?.canManageDonationLinks === true) && !isArchived
  const canEditContent = (auth.user?.capabilities
    ? hasCapability(auth.user, 'fundraisers_and_sponsors', 'edit', { type: 'campaign', id: campaign.id })
    : isAdmin || roles.includes('chair')) && !isArchived

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="Host Year"
        title={campaign.title}
        description="Edit your public Host Year page, fundraiser schedule, HåfaPass links, and class announcements. Donation and finance settings remain protected by role."
        actions={(
          <div className="row-actions">
            {campaignOptions.length > 1 && (
              <label className="field" style={{ minWidth: '14rem' }}>
                <span className="sr-only">Select campaign</span>
                <select
                  aria-label="Select host campaign"
                  value={selectedSlug}
                  onChange={(e) => setSearchParams({ campaign: e.target.value })}
                >
                  {campaignOptions.map((opt) => (
                    <option key={opt.slug} value={opt.slug}>{opt.title} ({opt.status})</option>
                  ))}
                </select>
              </label>
            )}
            {isAdmin && campaign.status === 'closing' && (
              <button className="btn primary" type="button" onClick={() => setTab('handoff', true)}>
                Prepare {campaign.hostClass ? `Class of ${campaign.hostClass.graduationYear + 1}` : 'next year'}
              </button>
            )}
            {isDraft ? (
              <span className="pill">Draft · Not public yet</span>
            ) : (
              <Link className="btn secondary" to={`/host-year/${campaign.slug}`} target="_blank" rel="noreferrer">
                View public page
              </Link>
            )}
          </div>
        )}
      />

      {isArchived && (
        <Panel className="state-card">
          <strong>Archived campaign (read-only)</strong>
          <p>This host year campaign is archived for historical record. Outgoing board members keep read-only access.</p>
        </Panel>
      )}

      {!isArchived && !canEditContent && !canManageDonationLinks && (
        <Panel>
          <p className="muted" style={{ margin: 0 }}>
            <strong>Read-only view:</strong> Your role ({roles.join(', ') || 'board'}) can view Host Year content. Chair or admin access is required to edit settings, events, or posts.
          </p>
        </Panel>
      )}

      <div className="row-actions" role="tablist" aria-label="Host Year workspace sections">
        <button type="button" role="tab" aria-selected={tab === 'events'} className={`btn ${tab === 'events' ? 'primary' : 'secondary'}`} onClick={() => setTab('events')}>
          Fundraiser Events ({events.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'posts'} className={`btn ${tab === 'posts' ? 'primary' : 'secondary'}`} onClick={() => setTab('posts')}>
          Class News ({posts.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} className={`btn ${tab === 'settings' ? 'primary' : 'secondary'}`} onClick={() => setTab('settings')}>
          Settings &amp; Links
        </button>
        <button type="button" role="tab" aria-selected={tab === 'handoff'} className={`btn ${tab === 'handoff' ? 'primary' : 'secondary'}`} onClick={() => setTab('handoff')}>
          Closeout &amp; Handoff
        </button>
      </div>

      {tab === 'settings' && (
        <HostYearSettingsPanel key={campaign.slug} campaign={campaign} canEdit={canEditContent} canManageDonationLinks={canManageDonationLinks} onSaved={workspaceQuery.reload} />
      )}

      {tab === 'events' && (
        <HostYearEventsPanel
          key={campaign.slug}
          campaign={campaign}
          events={events}
          canRecordFinance={canRecordFinance}
          canEdit={canEditContent}
          includeArchived={includeArchived}
          onToggleArchived={setIncludeArchived}
          onSaved={workspaceQuery.reload}
        />
      )}

      {tab === 'handoff' && (
        <CampaignHandoff key={campaign.slug} campaign={campaign} events={events}
          preparing={searchParams.get('action') === 'prepare'}
          onPrepare={() => setTab('handoff', true)}
          onCloseWizard={() => setTab('handoff')}
          onCampaignChange={async () => { await Promise.all([workspaceQuery.reload(), adminCampaignsQuery.reload()]) }} />
      )}

      {tab === 'posts' && (
        <HostYearPostsPanel
          key={campaign.slug}
          campaign={campaign}
          posts={posts}
          canEdit={canEditContent}
          onSaved={workspaceQuery.reload}
        />
      )}
    </div>
  )
}

function HostYearSettingsPanel({
  campaign,
  canEdit,
  canManageDonationLinks,
  onSaved,
}: {
  campaign: AdminHostCampaign
  canEdit: boolean
  canManageDonationLinks: boolean
  onSaved: () => Promise<void>
}) {
  const [title, setTitle] = useState(campaign.title)
  const [tagline, setTagline] = useState(campaign.tagline || '')
  const [description, setDescription] = useState(campaign.description || '')
  const [countdownTargetAt, setCountdownTargetAt] = useState(toDatetimeLocalValue(campaign.countdownTargetAt))
  const [countdownDirty, setCountdownDirty] = useState(false)
  const [countdownLabel, setCountdownLabel] = useState(campaign.countdownLabel || '')
  const [heroImageUrl, setHeroImageUrl] = useState(campaign.heroImageUrl || '')
  const [golfUrl, setGolfUrl] = useState(campaign.golfUrl || '')
  const [donationUrl, setDonationUrl] = useState(campaign.donationUrl || '')
  const [hafapassOrganizerSlug, setHafapassOrganizerSlug] = useState(campaign.hafapassOrganizerSlug || '')
  const [hafapassTournamentOrganizerSlug, setHafapassTournamentOrganizerSlug] = useState(campaign.hafapassTournamentOrganizerSlug || '')
  const [hafapassDistributionCode, setHafapassDistributionCode] = useState(campaign.hafapassDistributionCode || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setTitle(campaign.title)
    setTagline(campaign.tagline || '')
    setDescription(campaign.description || '')
    setCountdownTargetAt(toDatetimeLocalValue(campaign.countdownTargetAt))
    setCountdownDirty(false)
    setCountdownLabel(campaign.countdownLabel || '')
    setHeroImageUrl(campaign.heroImageUrl || '')
    setGolfUrl(campaign.golfUrl || '')
    setDonationUrl(campaign.donationUrl || '')
    setHafapassOrganizerSlug(campaign.hafapassOrganizerSlug || '')
    setHafapassTournamentOrganizerSlug(campaign.hafapassTournamentOrganizerSlug || '')
    setHafapassDistributionCode(campaign.hafapassDistributionCode || '')
  }, [campaign])

  const handleHeroUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const publicUrl = await uploadCampaignImage({ file, campaignSlug: campaign.slug })
      setHeroImageUrl(publicUrl)
      setMessage('Hero image uploaded. Save settings to publish.')
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to upload hero image'))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit && !canManageDonationLinks) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload: Record<string, unknown> = canEdit ? {
        title: title.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        countdownLabel: countdownLabel.trim() || null,
        heroImageUrl: heroImageUrl.trim() || null,
        golfUrl: golfUrl.trim() || null,
        hafapassOrganizerSlug: hafapassOrganizerSlug.trim().toLowerCase() || null,
        hafapassTournamentOrganizerSlug: hafapassTournamentOrganizerSlug.trim().toLowerCase() || null,
        hafapassDistributionCode: hafapassDistributionCode.trim().toLowerCase() || null,
      } : {}
      if (canManageDonationLinks) payload.donationUrl = donationUrl.trim() || null
      if (canEdit && countdownDirty) {
        payload.countdownTargetAt = fromDatetimeLocalValue(countdownTargetAt)
      }
      await api.campaignUpdateSettings(campaign.slug, payload)
      setCountdownDirty(false)
      setMessage('Host Year settings saved.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save settings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel>
      <div className="section-heading">
        <div>
          <h2>Public page &amp; HåfaPass settings</h2>
          <p>Status: <StatusBadge status={campaign.status} /> · Slug: <code>{campaign.slug}</code></p>
        </div>
      </div>
      <form onSubmit={handleSubmit}>
        <FormGrid>
          <Field label="Campaign title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} disabled={!canEdit} />
          </Field>
          <Field label="Tagline">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Road to the 2027 FD Alumni Tournament" disabled={!canEdit} />
          </Field>
          <Field label="Golf site URL (https://)">
            <input type="url" value={golfUrl} onChange={(e) => setGolfUrl(e.target.value)} placeholder="https://fd-golf.shimizu-technology.com" disabled={!canEdit} />
          </Field>
          {canManageDonationLinks && (
            <Field label="Donation URL (https://)">
              <input type="url" value={donationUrl} onChange={(event) => setDonationUrl(event.target.value)} />
            </Field>
          )}
          <Field label="Hero image URL (https://)">
            <input type="url" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://..." disabled={!canEdit} />
          </Field>
        </FormGrid>

        <Field label="Campaign description">
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
        </Field>

        <details className="admin-advanced-details" style={{ marginTop: '0.85rem' }}>
          <summary>Advanced · Countdown &amp; HåfaPass ticketing setup</summary>
          <div style={{ marginTop: '0.75rem' }}>
            <FormGrid>
              <Field label="Countdown label">
                <input value={countdownLabel} onChange={(e) => setCountdownLabel(e.target.value)} placeholder="Tentative tip-off · Jun 25, 2027" disabled={!canEdit} />
              </Field>
              <Field label="Countdown target date & time (local browser time; leave unchanged to follow tournament start)">
                <input
                  type="datetime-local"
                  value={countdownTargetAt}
                  onChange={(e) => {
                    setCountdownTargetAt(e.target.value)
                    setCountdownDirty(true)
                  }}
                  disabled={!canEdit}
                />
              </Field>
              <Field label="HåfaPass host class organizer slug">
                <input value={hafapassOrganizerSlug} onChange={(e) => setHafapassOrganizerSlug(e.target.value)} placeholder="co2017" disabled={!canEdit} />
              </Field>
              <Field label="HåfaPass tournament organizer slug (optional)">
                <input value={hafapassTournamentOrganizerSlug} onChange={(e) => setHafapassTournamentOrganizerSlug(e.target.value)} placeholder="fdaa" disabled={!canEdit} />
              </Field>
              <Field label="HåfaPass default distribution code">
                <input value={hafapassDistributionCode} onChange={(e) => setHafapassDistributionCode(e.target.value)} placeholder="co2017-hub" disabled={!canEdit} />
              </Field>
            </FormGrid>
          </div>
        </details>

        {(canEdit || canManageDonationLinks) && (
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            {canEdit && <label className="btn secondary small" style={{ cursor: 'pointer' }}>
              {uploading ? 'Uploading hero image…' : 'Upload hero image'}
              <input type="file" accept={WEB_IMAGE_UPLOAD_ACCEPT} onChange={handleHeroUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>}
            <button className="btn primary" type="submit" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}

        {message && <p role="status" style={{ marginTop: '0.75rem' }}>{message}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Panel>
  )
}

function HostYearEventsPanel({
  campaign,
  events,
  canRecordFinance,
  canEdit,
  includeArchived,
  onToggleArchived,
  onSaved,
}: {
  campaign: AdminHostCampaign
  events: AdminCampaignEvent[]
  canRecordFinance: boolean
  canEdit: boolean
  includeArchived: boolean
  onToggleArchived: (value: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [eventEditorOpen, setEventEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<CampaignEventKind>('fundraiser')
  const [title, setTitle] = useState('')
  const [recapEventId, setRecapEventId] = useState<string | null>(null)
  const [recapBusy, setRecapBusy] = useState(false)
  const [status, setStatus] = useState<CampaignEventStatus>('planned')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [dateLabel, setDateLabel] = useState('')
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [hafapassEventId, setHafapassEventId] = useState('')
  const [hafapassEventSlug, setHafapassEventSlug] = useState('')
  const [hafapassDistributionCode, setHafapassDistributionCode] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [goalDollars, setGoalDollars] = useState('')
  const [position, setPosition] = useState('0')
  const [publicVisible, setPublicVisible] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resetForm = () => {
    setEditingId(null)
    setKind('fundraiser')
    setTitle('')
    setStatus('planned')
    setStartsAt('')
    setEndsAt('')
    setDateLabel('')
    setVenue('')
    setDescription('')
    setImageUrl('')
    setHafapassEventId('')
    setHafapassEventSlug('')
    setHafapassDistributionCode('')
    setExternalUrl('')
    setCtaLabel('')
    setGoalDollars('')
    setPosition('0')
    setPublicVisible(true)
  }

  const closeEventEditor = () => {
    setEventEditorOpen(false)
    setError('')
    resetForm()
  }

  const startEdit = (ev: AdminCampaignEvent) => {
    setEventEditorOpen(true)
    setEditingId(ev.id)
    setKind(ev.kind)
    setTitle(ev.title)
    setStatus(ev.storedStatus || ev.status)
    setStartsAt(toDatetimeLocalValue(ev.startsAt))
    setEndsAt(toDatetimeLocalValue(ev.endsAt))
    setDateLabel(ev.dateLabel || '')
    setVenue(ev.venue || '')
    setDescription(ev.description || '')
    setImageUrl(ev.imageUrl || '')
    setHafapassEventId(ev.hafapassEventId || '')
    setHafapassEventSlug(ev.hafapassEventSlug || '')
    setHafapassDistributionCode(ev.hafapassDistributionCode || '')
    setExternalUrl(ev.externalUrl || '')
    setCtaLabel(ev.ctaLabel || '')
    setGoalDollars(centsToDollarsInput(ev.goalCents))
    setPosition(String(ev.position ?? 0))
    setPublicVisible(ev.publicVisible)
    setMessage('')
    setError('')
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading || saving) return
    setUploading(true)
    setError('')
    try {
      const publicUrl = await uploadCampaignImage({ file, campaignSlug: campaign.slug })
      setImageUrl(publicUrl)
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to upload flyer image'))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit || saving || uploading) return
    const parsedGoal = parseOptionalDollarsToCents(goalDollars)
    if (!parsedGoal.ok) {
      setError(`Fundraiser goal: ${parsedGoal.error}`)
      return
    }
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        kind,
        title: title.trim(),
        status,
        startsAt: fromDatetimeLocalValue(startsAt),
        endsAt: fromDatetimeLocalValue(endsAt),
        dateLabel: dateLabel.trim() || null,
        venue: venue.trim() || null,
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        hafapassEventId: hafapassEventId.trim() || null,
        hafapassEventSlug: hafapassEventSlug.trim().toLowerCase() || null,
        hafapassDistributionCode: hafapassDistributionCode.trim().toLowerCase() || null,
        externalUrl: externalUrl.trim() || null,
        ctaLabel: ctaLabel.trim() || null,
        goalCents: parsedGoal.value,
        position: Number.parseInt(position, 10) || 0,
        publicVisible,
      }
      if (editingId) {
        await api.campaignUpdateEvent(campaign.slug, editingId, payload)
        setMessage('Event updated.')
      } else {
        await api.campaignCreateEvent(campaign.slug, payload)
        setMessage('Event created.')
      }
      await onSaved()
      closeEventEditor()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save event'))
    } finally {
      setSaving(false)
    }
  }

  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null)

  const handleArchive = (ev: AdminCampaignEvent) => {
    if (!canEdit) return
    setConfirmRequest({
      title: `Archive "${ev.title}"?`,
      message: 'Archived events stay hidden from the public Host Year calendar while preserving finance links.',
      confirmLabel: 'Archive event',
      destructive: true,
      onConfirm: async () => {
        setError('')
        setMessage('')
        try {
          await api.campaignArchiveEvent(campaign.slug, ev.id)
          setMessage(`Archived "${ev.title}".`)
          if (editingId === ev.id) resetForm()
          await onSaved()
        } catch (err) {
          setError(mutationErrorMessage(err, 'Unable to archive event'))
        }
      },
    })
  }

  const flyerPreview = safeHttpsHref(imageUrl)

  return (
    <div className="page-stack">
      {canEdit && eventEditorOpen && (
        <AdminEditorDialog title={editingId ? 'Edit fundraiser' : 'Add fundraiser'} onClose={closeEventEditor} busy={saving || uploading}>
          <form className="stacked-form" onSubmit={handleSubmit}>
            <FormGrid>
              <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} placeholder="Two Pints, One Purpose" />
              </Field>
              <Field label="Kind">
                <select value={kind} onChange={(e) => setKind(e.target.value as CampaignEventKind)}>
                  {EVENT_KINDS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value as CampaignEventStatus)}>
                  {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </Field>
              <Field label="Venue">
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Antigu Brewery, Hagåtña" />
              </Field>
              <Field label="Starts at">
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </Field>
              <Field label="Ends at">
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </Field>
              <Field label="Date label (for TBA dates)">
                <input value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} placeholder="May 2027 (TBA)" />
              </Field>
            </FormGrid>

            <Field label="Description">
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary of the fundraiser, ticket price, or what to expect." />
            </Field>

            <div className="admin-event-flyer">
              <Field label={uploading ? 'Uploading flyer…' : flyerPreview ? 'Replace flyer image' : 'Upload flyer image'}>
                <input type="file" accept={WEB_IMAGE_UPLOAD_ACCEPT} onChange={handleImageUpload} disabled={uploading || saving} />
              </Field>
              {flyerPreview && (
                <div className="row-actions">
                  <img className="admin-event-thumbnail" src={flyerPreview} alt="Flyer preview" />
                  <button type="button" className="btn secondary small" disabled={uploading || saving} onClick={() => setImageUrl('')}>Remove flyer</button>
                </div>
              )}
              <details>
                <summary>Use an image URL</summary>
                <Field label="Flyer image URL (https://)">
                  <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." disabled={uploading || saving} />
                </Field>
              </details>
            </div>

            <details style={{ marginTop: '0.5rem' }}>
              <summary>Ticketing links &amp; advanced options (optional)</summary>
              <FormGrid>
                <Field label="External URL (Golf / signup https://)">
                  <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="CTA label override">
                  <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Get Tickets" />
                </Field>
                <Field label="HåfaPass Event ID (preferred match)">
                  <input value={hafapassEventId} onChange={(e) => setHafapassEventId(e.target.value)} placeholder="hp_101" />
                </Field>
                <Field label="HåfaPass Event Slug (fallback)">
                  <input value={hafapassEventSlug} onChange={(e) => setHafapassEventSlug(e.target.value)} placeholder="two-pints-2027" />
                </Field>
                <Field label="Per-event HåfaPass /go/:code">
                  <input value={hafapassDistributionCode} onChange={(e) => setHafapassDistributionCode(e.target.value)} placeholder="co2017-antigu" />
                </Field>
                <Field label="Fundraiser goal (USD, optional)">
                  <input value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} placeholder="5000" />
                </Field>
                <Field label="Sort position">
                  <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
                </Field>
              </FormGrid>
            </details>

            <label className="checkbox-row" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={publicVisible} onChange={(e) => setPublicVisible(e.target.checked)} />
              <span>Visible on public Host Year page</span>
            </label>

            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <button className="btn primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editingId ? 'Save event' : 'Create event'}
              </button>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </AdminEditorDialog>
      )}

      <Panel>
        <div className="section-heading">
          <h2>Campaign events ({events.length})</h2>
          <div className="row-actions">
            <label className="admin-inline-check">
              <input type="checkbox" checked={includeArchived} onChange={(e) => onToggleArchived(e.target.checked)} />
              <span>Show archived</span>
            </label>
            {canEdit && <button type="button" className="btn primary" onClick={() => {
              resetForm()
              setMessage('')
              setError('')
              setEventEditorOpen(true)
            }}>Add fundraiser</button>}
          </div>
        </div>
        {message && <p role="status">{message}</p>}
        {!eventEditorOpen && error && <p className="form-error" role="alert">{error}</p>}
        {events.length === 0 ? (
          <EmptyState title="No campaign events yet" description="Add your class fundraisers, golf tournament, or merch drops." />
        ) : (
          <div className="admin-list">
            {events.map((ev) => (
              <div key={ev.id}>
                <div className="compact-admin-row" style={{ padding: '0.85rem', borderBottom: '1px solid var(--line)' }}>
                  <div>
                    <strong>{ev.title}</strong>{' '}
                    {ev.autoCompleted && !ev.archivedAt
                      ? <span className="status-badge status-completed">Auto-completed</span>
                      : <StatusBadge status={ev.archivedAt ? 'archived' : ev.status === 'planned' ? 'upcoming' : ev.status} />}{' '}
                    {!ev.publicVisible && <span className="status-badge status-hidden">Hidden</span>}
                    <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                      {ev.kind.replace('_', ' ')} · {ev.dateLabel || (ev.startsAt ? new Date(ev.startsAt).toLocaleString() : 'Date TBA')}
                      {ev.venue ? ` · ${ev.venue}` : ''}
                    </p>
                    {(ev.hafapassEventId || ev.hafapassEventSlug || ev.hafapassDistributionCode) && (
                      <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                        HåfaPass: {ev.hafapassEventId ? `ID ${ev.hafapassEventId}` : ev.hafapassEventSlug}
                        {ev.hafapassDistributionCode ? ` · /go/${ev.hafapassDistributionCode}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="row-actions handoff-actions">
                    {canRecordFinance && !ev.archivedAt && (
                      <Link className="btn secondary small" to={`/admin/finance?campaign=${encodeURIComponent(campaign.slug)}&action=income&eventId=${ev.id}`}>
                        Record money from this event
                      </Link>
                    )}
                    {canEdit && !ev.archivedAt && (
                      <button type="button" className={`btn small ${ev.status === 'completed' ? 'primary' : 'secondary'}`}
                        disabled={recapBusy}
                        aria-expanded={recapEventId === ev.id} onClick={() => setRecapEventId(ev.id)}>
                        {hasEventRecap(ev) ? 'Edit Recap & Photos' : 'Add Recap & Photos'}
                      </button>
                    )}
                    {canEdit && <button type="button" className="btn secondary small" disabled={saving || uploading || recapBusy} onClick={() => startEdit(ev)}>Edit</button>}
                    {canEdit && !ev.archivedAt && (
                      <button type="button" className="btn secondary small" disabled={recapBusy && recapEventId === ev.id} onClick={() => void handleArchive(ev)}>Archive</button>
                    )}
                  </div>
                </div>
                {canEdit && !ev.archivedAt && recapEventId === ev.id && (
                  <EventRecapForm campaignSlug={campaign.slug} event={ev} onSaved={onSaved} onBusyChange={setRecapBusy} onClose={() => setRecapEventId(null)} />
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <AdminConfirmDialog request={confirmRequest} busy={saving} onClose={() => setConfirmRequest(null)} />
    </div>
  )
}

const recapPhotoLimit = 24

function hasEventRecap(event: AdminCampaignEvent) {
  return Boolean(event.recapNotes || event.recapHighlights || event.raisedDisplay || event.recapPhotos?.length)
}

function normalizeRecapPhotos(list: RecapPhoto[]) {
  return list.map(({ url, caption }) => ({ url, caption: caption?.trim() || '' }))
}

function EventRecapForm({ campaignSlug, event, onSaved, onBusyChange, onClose }: {
  campaignSlug: string
  event: AdminCampaignEvent
  onSaved: () => Promise<void>
  onBusyChange: (busy: boolean) => void
  onClose: () => void
}) {
  const [notes, setNotes] = useState(event.recapNotes || '')
  const [highlights, setHighlights] = useState(event.recapHighlights || '')
  const [raised, setRaised] = useState(event.raisedDisplay || '')
  const [photos, setPhotos] = useState<RecapPhoto[]>(event.recapPhotos || [])
  const [savedBaseline, setSavedBaseline] = useState(() => JSON.stringify({
    notes: (event.recapNotes || '').trim(),
    highlights: (event.recapHighlights || '').trim(),
    raised: (event.raisedDisplay || '').trim(),
    photos: normalizeRecapPhotos(event.recapPhotos || []),
  }))
  const [confirmClose, setConfirmClose] = useState<ConfirmDialogRequest | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const currentSnapshot = JSON.stringify({
    notes: notes.trim(),
    highlights: highlights.trim(),
    raised: raised.trim(),
    photos: normalizeRecapPhotos(photos),
  })
  const isDirty = currentSnapshot !== savedBaseline

  useEffect(() => {
    onBusyChange(uploading || saving)
    return () => onBusyChange(false)
  }, [uploading, saving, onBusyChange])

  const requestClose = () => {
    if (uploading || saving) return
    if (!isDirty) {
      onClose()
      return
    }
    setConfirmClose({
      title: 'Discard unsaved recap changes?',
      message: 'You have unsaved notes or uploaded photos. Close without saving?',
      confirmLabel: 'Discard changes',
      destructive: true,
      onConfirm: () => {
        setConfirmClose(null)
        onClose()
      },
    })
  }

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setPhotos((current) => {
      if (toIndex < 0 || toIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const uploadPhotos = async (change: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(change.currentTarget.files || [])
    change.currentTarget.value = ''
    if (!files.length || uploading || saving) return

    setMessage('')
    setError('')
    if (photos.length + files.length > recapPhotoLimit) {
      setError(`Choose up to ${recapPhotoLimit - photos.length} more photos.`)
      return
    }

    setUploading(true)
    try {
      const results = await Promise.allSettled(files.map((file) => uploadCampaignImage({ file, campaignSlug })))
      const added = results.flatMap((result) => result.status === 'fulfilled' ? [{ url: result.value }] : [])
      const failed = results.flatMap((result, index) => result.status === 'rejected' ? [files[index].name] : [])
      setPhotos((current) => [...current, ...added])
      if (added.length) {
        setMessage(`Uploaded ${added.length} ${added.length === 1 ? 'photo' : 'photos'} — tap Save recap below to publish.`)
      }
      if (failed.length) setError(`Could not upload ${failed.join(', ')}. Choose those files again to retry.`)
    } finally {
      setUploading(false)
    }
  }

  const save = async (submit: FormEvent) => {
    submit.preventDefault()
    if (uploading || saving) return

    setSaving(true)
    setMessage('')
    setError('')
    try {
      const cleanedNotes = notes.trim()
      const cleanedHighlights = highlights.trim()
      const cleanedRaised = raised.trim()
      const cleanedPhotos = photos.map(({ url, caption }) => ({ url, caption: caption?.trim() || undefined }))
      await api.campaignUpdateEvent(campaignSlug, event.id, {
        recapNotes: cleanedNotes || null,
        recapHighlights: cleanedHighlights || null,
        raisedDisplay: cleanedRaised || null,
        recapPhotos: cleanedPhotos,
      })
      setSavedBaseline(JSON.stringify({
        notes: cleanedNotes,
        highlights: cleanedHighlights,
        raised: cleanedRaised,
        photos: normalizeRecapPhotos(photos),
      }))
      setMessage('Recap saved.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save event recap'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AdminEditorDialog title={`Recap & photos for ${event.title}`} onClose={requestClose} busy={uploading || saving || Boolean(confirmClose)} drawer>
        <form className="admin-event-recap" onSubmit={save} aria-label={`Recap for ${event.title}`}>
          <Field label="Amount raised">
            <input value={raised} maxLength={80} disabled={saving} placeholder="$6,205+ raised" onChange={(change) => setRaised(change.target.value)} />
          </Field>
          <p className="muted-note" style={{ marginTop: '-0.35rem' }}>
            Optional badge shown on this event&apos;s recap card. Actual dollar totals on the public fundraising meter come from Board Finance.
          </p>
          <Field label="Recap notes">
            <textarea value={notes} rows={4} maxLength={5000} disabled={saving} placeholder="Share how the fundraiser went, thank brothers and sponsors, or add turnout highlights…" onChange={(change) => setNotes(change.target.value)} />
          </Field>
          <Field label="Recap highlights">
            <textarea value={highlights} rows={3} maxLength={1000} disabled={saving} placeholder="Optional short highlights (e.g., raffle winners, custom brews, turnout)." onChange={(change) => setHighlights(change.target.value)} />
          </Field>
          <Field label={uploading ? 'Uploading recap photos…' : 'Upload recap photos'}>
            <input type="file" multiple accept={WEB_IMAGE_UPLOAD_ACCEPT} onChange={(change) => void uploadPhotos(change)}
              disabled={uploading || saving || photos.length >= recapPhotoLimit} />
          </Field>
          <p className="muted-note">Select one or more photos from your phone or computer ({photos.length} of {recapPhotoLimit} added). The first photo leads the recap gallery.</p>
          {photos.length > 0 && (
            <div className="fundraiser-photo-grid admin-event-photos">
              {photos.map((photo, index) => (
                <div key={`${photo.url}-${index}`}>
                  <img className="admin-event-thumbnail" src={safeHttpsHref(photo.url) || undefined} alt={`Recap photo ${index + 1} preview`} />
                  {index === 0 && <span className="pill" style={{ justifySelf: 'start' }}>Lead photo</span>}
                  <Field label={`Caption for photo ${index + 1}`}>
                    <input value={photo.caption || ''} maxLength={240} disabled={saving} placeholder="Optional caption"
                      onChange={(change) => setPhotos((current) => current.map((item, photoIndex) =>
                        index === photoIndex ? { ...item, caption: change.target.value } : item))} />
                  </Field>
                  <div className="row-actions">
                    {photos.length > 1 && (
                      <>
                        <button type="button" className="btn secondary small" disabled={saving || index === 0}
                          aria-label={`Move photo ${index + 1} earlier`}
                          onClick={() => movePhoto(index, index - 1)}>
                          ← Earlier
                        </button>
                        <button type="button" className="btn secondary small" disabled={saving || index === photos.length - 1}
                          aria-label={`Move photo ${index + 1} later`}
                          onClick={() => movePhoto(index, index + 1)}>
                          Later →
                        </button>
                      </>
                    )}
                    <button type="button" className="btn secondary small" disabled={saving}
                      onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>
                      Remove photo {index + 1}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row-actions">
            <button type="submit" className="btn primary" disabled={uploading || saving}>{saving ? 'Saving…' : 'Save recap'}</button>
            <button type="button" className="btn secondary" disabled={uploading || saving} onClick={requestClose}>Close recap editor</button>
          </div>
          {message && (
            <p role="status">
              {message}{' '}
              {message === 'Recap saved.' && (
                <Link to={`/fundraisers/${event.id}`} target="_blank" rel="noreferrer">View public recap →</Link>
              )}
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
      </AdminEditorDialog>
      <AdminConfirmDialog request={confirmClose} busy={saving} onClose={() => setConfirmClose(null)} />
    </>
  )
}

function HostYearPostsPanel({
  campaign,
  posts,
  canEdit,
  onSaved,
}: {
  campaign: AdminHostCampaign
  posts: AdminCampaignPost[]
  canEdit: boolean
  onSaved: () => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [publishNow, setPublishNow] = useState(true)
  const [publishedAt, setPublishedAt] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setBody('')
    setImageUrl('')
    setPublishNow(true)
    setPublishedAt('')
    setPinned(false)
  }

  const startEdit = (post: AdminCampaignPost) => {
    setEditingId(post.id)
    setTitle(post.title)
    setBody(post.body)
    setImageUrl(post.imageUrl || '')
    setPublishNow(false)
    setPublishedAt(toDatetimeLocalValue(post.publishedAt))
    setPinned(post.pinned)
    setMessage('')
    setError('')
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const publicUrl = await uploadCampaignImage({ file, campaignSlug: campaign.slug })
      setImageUrl(publicUrl)
      setMessage('Image uploaded — tap Create post or Save post to publish.')
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to upload post image'))
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || null,
        publishedAt: publishNow ? new Date().toISOString() : fromDatetimeLocalValue(publishedAt),
        pinned,
      }
      if (editingId) {
        await api.campaignUpdatePost(campaign.slug, editingId, payload)
        setMessage('Post updated.')
      } else {
        await api.campaignCreatePost(campaign.slug, payload)
        setMessage(publishNow ? 'Post published.' : 'Post saved.')
      }
      resetForm()
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save post'))
    } finally {
      setSaving(false)
    }
  }

  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null)
  const postImagePreview = safeHttpsHref(imageUrl)

  const handleDelete = (post: AdminCampaignPost) => {
    if (!canEdit) return
    setConfirmRequest({
      title: `Delete "${post.title}"?`,
      message: 'This post will be removed from the Host Year feed. This action is logged in the activity log.',
      confirmLabel: 'Delete post',
      destructive: true,
      onConfirm: async () => {
        setError('')
        setMessage('')
        try {
          await api.campaignDeletePost(campaign.slug, post.id)
          setMessage(`Deleted "${post.title}".`)
          if (editingId === post.id) resetForm()
          await onSaved()
        } catch (err) {
          setError(mutationErrorMessage(err, 'Unable to delete post'))
        }
      },
    })
  }

  return (
    <div className="page-stack">
      {canEdit && (
        <Panel>
          <div className="section-heading">
            <h2>{editingId ? 'Edit class news post' : 'New class news post'}</h2>
            {editingId && <button type="button" className="btn secondary small" onClick={resetForm}>Cancel edit</button>}
          </div>
          <form onSubmit={handleSubmit}>
            <Field label="Headline">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} placeholder="Kickoff Night Recap" />
            </Field>

            <Field label="Body (plain text, blank lines separate paragraphs)">
              <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Share a fundraiser recap, upcoming date, or shoutout to alumni and sponsors…" />
            </Field>

            <div className="admin-event-flyer">
              <Field label={uploading ? 'Uploading image…' : postImagePreview ? 'Replace post image' : 'Upload post image (optional)'}>
                <input type="file" accept={WEB_IMAGE_UPLOAD_ACCEPT} onChange={handleImageUpload} disabled={uploading || saving} />
              </Field>
              {postImagePreview && (
                <div className="row-actions">
                  <img className="admin-event-thumbnail" src={postImagePreview} alt="Post image preview" />
                  <button type="button" className="btn secondary small" disabled={uploading || saving} onClick={() => setImageUrl('')}>Remove image</button>
                </div>
              )}
              <details>
                <summary>Use an image URL</summary>
                <Field label="Post image URL (https://)">
                  <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." disabled={uploading || saving} />
                </Field>
              </details>
            </div>

            <div className="row-actions" style={{ marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <label className="admin-inline-check">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                />
                <span>Publish immediately</span>
              </label>
              <label className="admin-inline-check">
                <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                <span>Pin to top of Host Year updates</span>
              </label>
            </div>

            {!publishNow && (
              <div className="row-actions" style={{ marginTop: '0.6rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Field label="Publish date & time (leave blank to save as draft)">
                  <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                </Field>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setPublishedAt(toDatetimeLocalValue(new Date().toISOString()))}
                >
                  Set publish to now
                </button>
              </div>
            )}

            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <button className="btn primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editingId ? 'Save post' : publishNow ? 'Publish post' : 'Save draft / schedule'}
              </button>
            </div>
            {message && <p role="status" style={{ marginTop: '0.6rem' }}>{message}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Panel>
      )}

      <Panel>
        <div className="section-heading">
          <h2>Class news posts ({posts.length})</h2>
        </div>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Share fundraiser recaps, alumni announcements, and host class updates." />
        ) : (
          <div className="admin-list">
            {posts.map((post) => (
              <div key={post.id} className="compact-admin-row" style={{ padding: '0.85rem', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{post.title}</strong>{' '}
                  {post.pinned && <span className="pill">Pinned</span>}{' '}
                  <StatusBadge status={post.published ? 'active' : 'draft'} />
                  <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                    {post.publishedAt ? `Published ${new Date(post.publishedAt).toLocaleString()}` : 'Draft (not public yet)'}
                    {post.authorName ? ` · ${post.authorName}` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="row-actions">
                    <button type="button" className="btn secondary small" onClick={() => startEdit(post)}>Edit</button>
                    <button type="button" className="btn secondary small" onClick={() => void handleDelete(post)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <AdminConfirmDialog request={confirmRequest} busy={saving} onClose={() => setConfirmRequest(null)} />
    </div>
  )
}
