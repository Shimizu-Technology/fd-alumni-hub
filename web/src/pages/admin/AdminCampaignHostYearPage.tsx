import { hasCapability } from '../../lib/adminModules'
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthContext } from '../../contexts/AuthContext'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import { ADMIN_IMAGE_UPLOAD_ACCEPT, uploadCampaignImage } from '../../lib/uploads'
import type {
  AdminCampaignEvent,
  AdminCampaignPost,
  AdminHostCampaign,
  CampaignEventKind,
  CampaignEventStatus,
} from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

type WorkspaceTab = 'settings' | 'events' | 'posts'

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
  const [tab, setTab] = useState<WorkspaceTab>('settings')
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
    if (requestedSlug && campaignOptions.some((c) => c.slug === requestedSlug)) return requestedSlug
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

      {!isArchived && !canEditContent && (
        <Panel>
          <p className="muted" style={{ margin: 0 }}>
            <strong>Read-only view:</strong> Your role ({roles.join(', ') || 'board'}) can view Host Year content. Chair or admin access is required to edit settings, events, or posts.
          </p>
        </Panel>
      )}

      <div className="row-actions" role="tablist" aria-label="Host Year workspace sections">
        <button type="button" role="tab" aria-selected={tab === 'settings'} className={`btn ${tab === 'settings' ? 'primary' : 'secondary'}`} onClick={() => setTab('settings')}>
          Settings &amp; Links
        </button>
        <button type="button" role="tab" aria-selected={tab === 'events'} className={`btn ${tab === 'events' ? 'primary' : 'secondary'}`} onClick={() => setTab('events')}>
          Fundraiser Events ({events.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'posts'} className={`btn ${tab === 'posts' ? 'primary' : 'secondary'}`} onClick={() => setTab('posts')}>
          Class News ({posts.length})
        </button>
      </div>

      {tab === 'settings' && (
        <HostYearSettingsPanel key={campaign.slug} campaign={campaign} canEdit={canEditContent} onSaved={workspaceQuery.reload} />
      )}

      {tab === 'events' && (
        <HostYearEventsPanel
          key={campaign.slug}
          campaign={campaign}
          events={events}
          canEdit={canEditContent}
          includeArchived={includeArchived}
          onToggleArchived={setIncludeArchived}
          onSaved={workspaceQuery.reload}
        />
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
  onSaved,
}: {
  campaign: AdminHostCampaign
  canEdit: boolean
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
    if (!canEdit) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        countdownLabel: countdownLabel.trim() || null,
        heroImageUrl: heroImageUrl.trim() || null,
        golfUrl: golfUrl.trim() || null,
        hafapassOrganizerSlug: hafapassOrganizerSlug.trim().toLowerCase() || null,
        hafapassTournamentOrganizerSlug: hafapassTournamentOrganizerSlug.trim().toLowerCase() || null,
        hafapassDistributionCode: hafapassDistributionCode.trim().toLowerCase() || null,
      }
      if (countdownDirty) {
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
          <Field label="Countdown label">
            <input value={countdownLabel} onChange={(e) => setCountdownLabel(e.target.value)} placeholder="Tentative tip-off · Jun 25, 2027" disabled={!canEdit} />
          </Field>
          <Field label="Golf site URL (https://)">
            <input type="url" value={golfUrl} onChange={(e) => setGolfUrl(e.target.value)} placeholder="https://fd-golf.shimizu-technology.com" disabled={!canEdit} />
          </Field>
          <Field label="Hero image URL (https://)">
            <input type="url" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://..." disabled={!canEdit} />
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

        <Field label="Campaign description">
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
        </Field>

        {canEdit && (
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            <label className="btn secondary small" style={{ cursor: 'pointer' }}>
              {uploading ? 'Uploading hero image…' : 'Upload hero image'}
              <input type="file" accept={ADMIN_IMAGE_UPLOAD_ACCEPT} onChange={handleHeroUpload} disabled={uploading} style={{ display: 'none' }} />
            </label>
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
  canEdit,
  includeArchived,
  onToggleArchived,
  onSaved,
}: {
  campaign: AdminHostCampaign
  events: AdminCampaignEvent[]
  canEdit: boolean
  includeArchived: boolean
  onToggleArchived: (value: boolean) => void
  onSaved: () => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [kind, setKind] = useState<CampaignEventKind>('fundraiser')
  const [title, setTitle] = useState('')
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

  const startEdit = (ev: AdminCampaignEvent) => {
    setEditingId(ev.id)
    setKind(ev.kind)
    setTitle(ev.title)
    setStatus(ev.status)
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
    if (!file) return
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
    if (!canEdit) return
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
      resetForm()
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save event'))
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async (ev: AdminCampaignEvent) => {
    if (!canEdit) return
    if (!window.confirm(`Archive "${ev.title}"? Archived events stay hidden from the public Host Year calendar while preserving finance links.`)) return
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
  }

  return (
    <div className="page-stack">
      {canEdit && (
        <Panel>
          <div className="section-heading">
            <h2>{editingId ? 'Edit fundraiser event' : 'Add fundraiser or host event'}</h2>
            {editingId && <button type="button" className="btn secondary small" onClick={resetForm}>Cancel edit</button>}
          </div>
          <form onSubmit={handleSubmit}>
            <FormGrid>
              <Field label="Kind">
                <select value={kind} onChange={(e) => setKind(e.target.value as CampaignEventKind)}>
                  {EVENT_KINDS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </Field>
              <Field label="Title">
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} placeholder="Two Pints, One Purpose" />
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value as CampaignEventStatus)}>
                  {EVENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
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
              <Field label="Venue">
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Antigu Brewery" />
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
              <Field label="External URL (Golf / signup https://)">
                <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="CTA label override">
                <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Get Tickets" />
              </Field>
              <Field label="Flyer image URL (https://)">
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Fundraiser goal (USD, optional)">
                <input value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)} placeholder="5000" />
              </Field>
              <Field label="Sort position">
                <input type="number" value={position} onChange={(e) => setPosition(e.target.value)} />
              </Field>
            </FormGrid>

            <Field label="Description">
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            <label className="checkbox-row" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" checked={publicVisible} onChange={(e) => setPublicVisible(e.target.checked)} />
              <span>Visible on public Host Year page</span>
            </label>

            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <label className="btn secondary small" style={{ cursor: 'pointer' }}>
                {uploading ? 'Uploading flyer…' : 'Upload flyer image'}
                <input type="file" accept={ADMIN_IMAGE_UPLOAD_ACCEPT} onChange={handleImageUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
              <button className="btn primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editingId ? 'Save event' : 'Create event'}
              </button>
            </div>
            {message && <p role="status" style={{ marginTop: '0.6rem' }}>{message}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </form>
        </Panel>
      )}

      <Panel>
        <div className="section-heading">
          <h2>Campaign events ({events.length})</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={includeArchived} onChange={(e) => onToggleArchived(e.target.checked)} />
            <span>Show archived</span>
          </label>
        </div>
        {events.length === 0 ? (
          <EmptyState title="No campaign events yet" description="Add your class fundraisers, golf tournament, or merch drops above." />
        ) : (
          <div className="admin-list">
            {events.map((ev) => (
              <div key={ev.id} className="compact-admin-row" style={{ padding: '0.85rem', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{ev.title}</strong>{' '}
                  <StatusBadge status={ev.archivedAt ? 'archived' : ev.status} />{' '}
                  {!ev.publicVisible && <span className="pill">Hidden</span>}
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
                {canEdit && (
                  <div className="row-actions">
                    <button type="button" className="btn secondary small" onClick={() => startEdit(ev)}>Edit</button>
                    {!ev.archivedAt && (
                      <button type="button" className="btn secondary small" onClick={() => void handleArchive(ev)}>Archive</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
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
    setPublishedAt('')
    setPinned(false)
  }

  const startEdit = (post: AdminCampaignPost) => {
    setEditingId(post.id)
    setTitle(post.title)
    setBody(post.body)
    setImageUrl(post.imageUrl || '')
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
    try {
      const publicUrl = await uploadCampaignImage({ file, campaignSlug: campaign.slug })
      setImageUrl(publicUrl)
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
        publishedAt: fromDatetimeLocalValue(publishedAt),
        pinned,
      }
      if (editingId) {
        await api.campaignUpdatePost(campaign.slug, editingId, payload)
        setMessage('Post updated.')
      } else {
        await api.campaignCreatePost(campaign.slug, payload)
        setMessage('Post created.')
      }
      resetForm()
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to save post'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (post: AdminCampaignPost) => {
    if (!canEdit) return
    if (!window.confirm(`Delete post "${post.title}"? This action is logged in the audit trail.`)) return
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
            <FormGrid>
              <Field label="Headline">
                <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} placeholder="Kickoff Night Recap" />
              </Field>
              <Field label="Publish date & time (leave blank for draft)">
                <input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
              </Field>
              <Field label="Post image URL (https://)">
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </Field>
            </FormGrid>

            <Field label="Body (plain text, blank lines separate paragraphs)">
              <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required />
            </Field>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span>Pin to top of Host Year updates</span>
            </label>

            <div className="row-actions" style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setPublishedAt(toDatetimeLocalValue(new Date().toISOString()))}
              >
                Set publish to now
              </button>
              <label className="btn secondary small" style={{ cursor: 'pointer' }}>
                {uploading ? 'Uploading image…' : 'Upload post image'}
                <input type="file" accept={ADMIN_IMAGE_UPLOAD_ACCEPT} onChange={handleImageUpload} disabled={uploading} style={{ display: 'none' }} />
              </label>
              <button className="btn primary" type="submit" disabled={saving || uploading}>
                {saving ? 'Saving…' : editingId ? 'Save post' : 'Create post'}
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
    </div>
  )
}
