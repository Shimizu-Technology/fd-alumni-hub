import { useAuthContext } from '../../contexts/AuthContext'
import { hasCapability } from '../../lib/adminModules'
import type { AccessDirectory, GrantScope, GrantSelection, PermissionGrant } from '../../lib/access'
import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { CampaignRole } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'
import { AdminConfirmDialog, type ConfirmDialogRequest } from '../../components/admin/AdminConfirmDialog'

const CAMPAIGN_ROLES: CampaignRole[] = ['chair', 'treasurer', 'board']

function LegacyPeopleAccess() {
  const baseQuery = useAsync(async () => {
    const [campaignsRes, whitelistsRes] = await Promise.all([
      api.adminCampaigns(),
      api.adminWhitelists(),
    ])
    return {
      campaigns: campaignsRes.campaigns,
      whitelists: whitelistsRes.whitelists,
    }
  }, [])

  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const campaigns = baseQuery.data?.campaigns || []
  const effectiveCampaignId = useMemo(() => {
    if (selectedCampaignId && campaigns.some((c) => c.id === selectedCampaignId)) return selectedCampaignId
    return campaigns[0]?.id || ''
  }, [selectedCampaignId, campaigns])

  const campaignPeopleQuery = useAsync(async () => {
    if (!effectiveCampaignId) return null
    const [membershipsRes, invitationsRes] = await Promise.all([
      api.adminCampaignMemberships(effectiveCampaignId),
      api.adminCampaignInvitations(effectiveCampaignId),
    ])
    return {
      campaignId: effectiveCampaignId,
      memberships: membershipsRes.memberships,
      users: membershipsRes.users,
      invitations: invitationsRes.invitations,
    }
  }, [effectiveCampaignId])

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CampaignRole>('chair')
  const [assignUserId, setAssignUserId] = useState('')
  const [assignRole, setAssignRole] = useState<CampaignRole>('board')
  const [wlEmail, setWlEmail] = useState('')
  const [wlRole, setWlRole] = useState<'admin' | 'staff' | 'scorekeeper'>('staff')
  const [wlNotes, setWlNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault()
    if (!effectiveCampaignId) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminCreateCampaignInvitation(effectiveCampaignId, { email: inviteEmail.trim(), role: inviteRole })
      setInviteEmail('')
      setMessage('Campaign invitation created. It will auto-accept when the user signs in with a verified email.')
      await campaignPeopleQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to send invitation'))
    } finally {
      setBusy(false)
    }
  }

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!effectiveCampaignId) return
    if (!window.confirm(`Revoke pending invitation for ${email}?`)) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminRevokeCampaignInvitation(effectiveCampaignId, invitationId)
      setMessage('Invitation revoked.')
      await campaignPeopleQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to revoke invitation'))
    } finally {
      setBusy(false)
    }
  }

  const handleAssignMembership = async (event: FormEvent) => {
    event.preventDefault()
    if (!effectiveCampaignId || !assignUserId) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminCreateCampaignMembership(effectiveCampaignId, { userId: assignUserId, role: assignRole })
      setAssignUserId('')
      setMessage('Campaign role granted.')
      await campaignPeopleQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to grant campaign role'))
    } finally {
      setBusy(false)
    }
  }

  const handleToggleMembership = async (membershipId: string, label: string, nextActive: boolean) => {
    if (!effectiveCampaignId) return
    if (!nextActive && !window.confirm(`Deactivate campaign access for ${label}?`)) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminUpdateCampaignMembership(effectiveCampaignId, membershipId, { active: nextActive })
      setMessage(nextActive ? 'Membership reactivated.' : 'Membership deactivated.')
      await campaignPeopleQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to update membership'))
    } finally {
      setBusy(false)
    }
  }

  const handleCreateWhitelist = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminCreateWhitelist({ email: wlEmail.trim(), role: wlRole, notes: wlNotes.trim() || null })
      setWlEmail('')
      setWlNotes('')
      setMessage('Site-wide allowlist entry created.')
      await baseQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to add allowlist entry'))
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateWhitelist = async (id: string, email: string, payload: { active?: boolean; role?: 'admin' | 'staff' | 'scorekeeper' | 'viewer' }) => {
    if (payload.role === 'admin' && !window.confirm(`Grant full system Admin role to ${email}?`)) return
    if (payload.active === false && !window.confirm(`Deactivate site-wide allowlist entry for ${email}?`)) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await api.adminUpdateWhitelist(id, payload)
      setMessage('Allowlist entry updated.')
      await baseQuery.reload()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to update allowlist entry'))
    } finally {
      setBusy(false)
    }
  }

  if (baseQuery.loading && !baseQuery.data) return <LoadingState label="Loading people and roles" />
  if (baseQuery.error) return <ErrorState message={baseQuery.error} onRetry={baseQuery.reload} />

  const whitelists = baseQuery.data?.whitelists || []
  const campaignPeopleReady = Boolean(campaignPeopleQuery.data && campaignPeopleQuery.data.campaignId === effectiveCampaignId)
  const memberships = campaignPeopleReady ? (campaignPeopleQuery.data?.memberships || []) : []
  const invitations = campaignPeopleReady ? (campaignPeopleQuery.data?.invitations || []) : []
  const users = campaignPeopleReady ? (campaignPeopleQuery.data?.users || []) : []

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="System · Admin only"
        title="People &amp; Roles"
        description="Invite host class officers (chair, treasurer, board) by verified email and manage site-wide tournament staff &amp; admin allowlists."
      />

      {message && <Panel><p role="status" style={{ margin: 0 }}>{message}</p></Panel>}
      {error && <Panel><p className="form-error" role="alert" style={{ margin: 0 }}>{error}</p></Panel>}

      <Panel>
        <div className="section-heading">
          <div>
            <h2>Host campaign board &amp; invitations</h2>
            <p>Board members only see their assigned campaign workspace and never receive tournament-wide staff privileges.</p>
          </div>
          {campaigns.length > 0 && (
            <select aria-label="Select campaign for people" value={effectiveCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
            </select>
          )}
        </div>

        {!effectiveCampaignId ? (
          <EmptyState title="No host campaigns yet" description="Create a host campaign first before inviting host class officers." />
        ) : campaignPeopleQuery.error ? (
          <ErrorState message={campaignPeopleQuery.error} onRetry={campaignPeopleQuery.reload} />
        ) : campaignPeopleQuery.loading && !campaignPeopleReady ? (
          <LoadingState label="Loading campaign members and invitations" />
        ) : (
          <div className="page-stack">
            <form onSubmit={handleInvite}>
              <h3>Invite officer by email</h3>
              <FormGrid>
                <Field label="Verified Clerk email">
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="officer@example.com" />
                </Field>
                <Field label="Campaign role">
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CampaignRole)}>
                    {CAMPAIGN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
              </FormGrid>
              <button className="btn primary" type="submit" disabled={busy}>Create invitation</button>
            </form>

            {users.length > 0 && (
              <form onSubmit={handleAssignMembership}>
                <h3>Assign role to existing user</h3>
                <FormGrid>
                  <Field label="Existing user">
                    <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} required>
                      <option value="">Select user…</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                    </select>
                  </Field>
                  <Field label="Campaign role">
                    <select value={assignRole} onChange={(e) => setAssignRole(e.target.value as CampaignRole)}>
                      {CAMPAIGN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </FormGrid>
                <button className="btn secondary" type="submit" disabled={busy}>Grant role</button>
              </form>
            )}

            <div>
              <h3>Active &amp; inactive memberships ({memberships.length})</h3>
              {memberships.length === 0 ? (
                <p className="muted">No members assigned yet.</p>
              ) : (
                <div className="admin-list">
                  {memberships.map((m) => (
                    <div key={m.id} className="compact-admin-row" style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
                      <div>
                        <strong>{m.userName || m.userEmail}</strong>{' '}
                        <span className="pill">{m.role}</span>{' '}
                        <StatusBadge status={m.active ? 'active' : 'cancelled'} />
                        <p className="muted" style={{ margin: '0.2rem 0 0' }}>{m.userEmail}</p>
                      </div>
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={busy}
                        onClick={() => void handleToggleMembership(m.id, m.userEmail || m.userName || m.id, !m.active)}
                      >
                        {m.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3>Invitations ({invitations.length})</h3>
              {invitations.length === 0 ? (
                <p className="muted">No invitations yet.</p>
              ) : (
                <div className="admin-list">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="compact-admin-row" style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
                      <div>
                        <strong>{inv.email}</strong>{' '}
                        <span className="pill">{inv.role}</span>{' '}
                        <StatusBadge status={inv.status} />
                      </div>
                      {inv.status === 'pending' && (
                        <button type="button" className="btn secondary small" disabled={busy} onClick={() => void handleRevokeInvitation(inv.id, inv.email)}>
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="section-heading">
          <div>
            <h2>Site-wide staff &amp; admin allowlist ({whitelists.length})</h2>
            <p>Controls tournament operations access across the hub. You cannot demote or deactivate your own admin account.</p>
          </div>
        </div>

        <form onSubmit={handleCreateWhitelist} style={{ marginBottom: '1rem' }}>
          <FormGrid>
            <Field label="Email">
              <input type="email" value={wlEmail} onChange={(e) => setWlEmail(e.target.value)} required placeholder="staff@example.com" />
            </Field>
            <Field label="Site role">
              <select value={wlRole} onChange={(e) => setWlRole(e.target.value as 'admin' | 'staff' | 'scorekeeper')}>
                <option value="scorekeeper">Scorekeeper (game-night scoring only)</option>
                <option value="staff">Staff (tournament ops)</option>
                <option value="admin">Admin (full system)</option>
              </select>
            </Field>
            <Field label="Notes">
              <input value={wlNotes} onChange={(e) => setWlNotes(e.target.value)} placeholder="2027 scorekeeper" />
            </Field>
          </FormGrid>
          <button className="btn primary" type="submit" disabled={busy}>Add allowlist entry</button>
        </form>

        <div className="admin-list">
          {whitelists.map((wl) => (
            <div key={wl.id} className="compact-admin-row" style={{ padding: '0.65rem 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <strong>{wl.email}</strong>{' '}
                <span className="pill">{wl.role}</span>{' '}
                <StatusBadge status={wl.active ? 'active' : 'cancelled'} />
                {wl.notes && <p className="muted" style={{ margin: '0.2rem 0 0' }}>{wl.notes}</p>}
              </div>
              <div className="row-actions">
                <select
                  aria-label={`Site role for ${wl.email}`}
                  value={wl.role}
                  disabled={busy}
                  onChange={(e) => void handleUpdateWhitelist(wl.id, wl.email, { role: e.target.value as 'admin' | 'staff' | 'scorekeeper' | 'viewer' })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="scorekeeper">Scorekeeper</option>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={busy}
                  onClick={() => void handleUpdateWhitelist(wl.id, wl.email, { active: !wl.active })}
                >
                  {wl.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

const capabilityLabels: Record<string, string> = {
  site_mode_and_settings: 'Site settings',
  tonights_menu_and_news: "Tonight’s menu and news",
  schedule_and_teams: 'Schedule and teams',
  scores_and_stats: 'Scores and stats',
  brackets: 'Brackets',
  fundraisers_and_sponsors: 'Fundraisers and sponsors',
  finance_and_reimbursements: 'Finance and reimbursements',
  history_and_media: 'History and media',
  manage_admins: 'People and access',
  view_audit_log: 'Audit history',
}

const actionLabels: Record<string, string> = {
  view_receipts: 'View receipts', request_correction: 'Request corrections',
  correct_final: 'Correct final scores', publish_stats: 'Publish stats',
  alert_site_wide: 'Send a site-wide alert', manage_donation_links: 'Manage donation links',
}

const accessLabel = (key: string) => capabilityLabels[key] ?? key.replaceAll('_', ' ')
const actionLabel = (key: string) => actionLabels[key] ?? key.replaceAll('_', ' ')

function describeGrant(grant: GrantSelection) {
  if (grant.capability === 'tonights_menu_and_news' && grant.actions.includes('publish')) return 'post tonight’s menu'
  if (grant.capability === 'scores_and_stats' && grant.actions.includes('edit')) return 'enter scores'
  return `${new Intl.ListFormat('en').format(grant.actions.map((action) => actionLabel(action).toLowerCase()))} ${accessLabel(grant.capability).toLowerCase()}`
}

const presetDescriptions: Record<string, string> = {
  class_chair: 'Lead campaign events, approvals, and organizer access.',
  treasurer: 'Record campaign money and manage reimbursements.',
  board_viewer: 'Review campaign finances, fundraisers, and audit history.',
  scorekeeper: 'Enter game scores and request result corrections.',
  game_night_coordinator: 'Publish menus and game-night updates.',
  fundraiser_sponsor_lead: 'Manage sponsors and publish fundraiser content.',
}

export function AdminPeoplePage() {
  const { user } = useAuthContext()
  const superAdmin = Boolean(user?.isSuperAdmin ?? user?.isAdmin)
  const query = useAsync(api.adminPermissionGrants, [])
  const [email, setEmail] = useState('')
  const [scopeType, setScopeType] = useState(superAdmin ? 'site' : 'campaign')
  const [scopeId, setScopeId] = useState('')
  const [presetKey, setPresetKey] = useState<string>()
  const [grants, setGrants] = useState<GrantSelection[]>([])
  const [legacy, setLegacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lastInvitedEmail, setLastInvitedEmail] = useState<string | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmDialogRequest | null>(null)

  if (query.loading && !query.data) return <LoadingState label="Loading access directory" />
  if (!query.data) return <ErrorState message={String(query.error || "Unable to load access.")} onRetry={query.reload} />

  const directory = query.data
  const scopeName = (type: string, id: string | null) => {
    if (type === 'site') return 'the whole site'
    if (type === 'campaign') return directory.campaigns.find((campaign) => campaign.id === id)?.title ?? 'the selected campaign'
    const tournament = directory.tournaments.find((entry) => entry.id === id)
    return tournament ? `the ${tournament.year} tournament` : 'the selected tournament'
  }
  const canEdit = (type: string, id: string | null) =>
    superAdmin || Boolean(type !== 'site' && id && hasCapability(user, 'manage_admins', 'edit', { type, id }))
  const canEditAny = superAdmin || hasCapability(user, 'manage_admins', 'edit')
  const editableChoicesFor = (type: string) => {
    const raw = type === 'campaign'
      ? directory.campaigns.map((campaign) => ({ id: campaign.id, name: campaign.title }))
      : type === 'tournament'
        ? directory.tournaments.map((tournament) => ({ id: tournament.id, name: `${tournament.year} · ${tournament.name}` }))
        : []
    return raw.filter((choice) => canEdit(type, choice.id))
  }
  const defaultScopeIdFor = (type: string) => {
    const choices = editableChoicesFor(type)
    return choices.length === 1 ? choices[0].id : ''
  }
  const scopeChoices = scopeType === 'campaign'
    ? directory.campaigns.map((campaign) => ({ id: campaign.id, name: campaign.title }))
    : directory.tournaments.map((tournament) => ({ id: tournament.id, name: `${tournament.year} · ${tournament.name}` }))
  const subject = directory.users.find((person) => person.email === email.trim().toLowerCase())?.fullName ?? (email.trim() || 'This person')

  const adminSignInUrl = typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}/admin`
    : 'https://fd-alumni.shimizu-technology.com/admin'

  const inviteMessageFor = (targetEmail: string) =>
    `Hey! I added ${targetEmail} to the FD Alumni Hub admin. Go to ${adminSignInUrl} and sign in with that email (Google or email code) — your access is ready right away.`

  const copyInvite = async (targetEmail: string) => {
    setError('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(inviteMessageFor(targetEmail))
      setCopiedEmail(targetEmail)
    } catch {
      setError(`Could not copy automatically. Share ${adminSignInUrl} and tell ${targetEmail} to sign in with that email.`)
    }
  }

  const mutate = async (operation: () => Promise<unknown>, notice: string, invitedEmail: string | null = null) => {
    setBusy(true)
    setMessage('')
    setError('')
    setCopiedEmail(null)
    try {
      await operation()
      await query.reload()
      setLastInvitedEmail(invitedEmail)
      setMessage(notice)
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to update access.'))
    } finally {
      setBusy(false)
    }
  }

  function toggleAction(capability: string, action: string) {
    setGrants((previous) => {
      const current = previous.find((entry) => entry.capability === capability)?.actions ?? []
      const actions = current.includes(action) ? current.filter((value) => value !== action) : [...current, action]
      return [...previous.filter((entry) => entry.capability !== capability), ...(actions.length ? [{ capability, actions }] : [])]
    })
  }

  function removeScope(scope: GrantScope) {
    const name = scopeName(scope.scopeType, scope.scopeId)
    setConfirmRequest({
      title: 'Remove scoped access?',
      message: `Remove ${scope.email}’s access for ${name}? Their account and access to other seasons or campaigns stay active.`,
      confirmLabel: 'Remove access',
      destructive: true,
      onConfirm: () => mutate(() => api.revokePermissionScope(scope), 'Scoped access removed.'),
    })
  }

  function scopeGroups(personEmail: string, rows: PermissionGrant[], memberships: AccessDirectory['users'][number]['campaignMemberships'] = []) {
    const scopes = new Map<string, GrantScope>()
    for (const membership of memberships) {
      scopes.set(`campaign:${membership.campaignId}`, { email: personEmail, scopeType: 'campaign', scopeId: membership.campaignId })
    }
    for (const row of rows) scopes.set(`${row.scopeType}:${row.scopeId}`, { email: personEmail, scopeType: row.scopeType, scopeId: row.scopeId })
    return [...scopes].map(([key, scope]) => (
      <div key={key} className="people-scope-block">
        <strong className="people-scope-title">{scopeName(scope.scopeType, scope.scopeId)}</strong>
        <ul>
          {rows.filter((row) => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId).map((row) => (
            <li key={row.id}>{accessLabel(row.capability)} · {row.actions.map(actionLabel).join(', ')}</li>
          ))}
          {memberships.filter((membership) => scope.scopeType === 'campaign' && membership.campaignId === scope.scopeId).map((membership) => (
            <li key={membership.campaignId}>Campaign membership · {membership.roles.join(', ')}</li>
          ))}
        </ul>
        {canEdit(scope.scopeType, scope.scopeId) && <div className="people-chip-row">
          <button type="button" className="btn secondary small" disabled={busy} onClick={() => {
            setEmail(personEmail)
            setScopeType(scope.scopeType)
            setScopeId(scope.scopeId || '')
            setPresetKey(undefined)
            setGrants(rows.filter((row) => row.scopeType === scope.scopeType && row.scopeId === scope.scopeId)
              .map(({ capability, actions }) => ({ capability, actions })))
            document.getElementById('grant-email')?.focus()
          }}>Edit scoped grants</button>
          <button type="button" className="btn secondary small" disabled={busy}
            onClick={() => removeScope(scope)}>{scope.scopeType === 'site' ? 'Remove whole-site grants' : "Remove this season/campaign’s access"}</button>
        </div>}
      </div>
    ))
  }

  return (
    <div className="page-stack">
      <PageHeader title="People & access" description="Give people the access they need for their season or campaign." />
      {message && (
        <div role="status" className="row-actions" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{message}</span>
          {lastInvitedEmail && (
            <button type="button" className="btn secondary small" onClick={() => void copyInvite(lastInvitedEmail)}>
              {copiedEmail === lastInvitedEmail ? 'Copied invite!' : 'Copy WhatsApp invite'}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
      {canEditAny && (
        <Panel>
          <h2>Invite or update access</h2>
          <form onSubmit={(event) => {
            event.preventDefault()
            if (!canEdit(scopeType, scopeId || null)) return
            const normalizedEmail = email.trim().toLowerCase()
            const alreadyActive = directory.users.some((person) => person.email.toLowerCase() === normalizedEmail)
            const notice = alreadyActive
              ? 'Access saved.'
              : `Access saved for ${normalizedEmail}. No email is sent automatically — copy and text them the sign-in link.`
            void mutate(
              () => api.assignPermissionGrants({ email: email.trim(), scopeType, scopeId: scopeId || null, presetKey, grants }),
              notice,
              alreadyActive ? null : normalizedEmail,
            )
          }}>
            <FormGrid>
              <Field label="Email address"><input id="grant-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
              <Field label="Scope">
                <select value={scopeType} onChange={(event) => {
                  const nextType = event.target.value
                  setScopeType(nextType)
                  setScopeId(defaultScopeIdFor(nextType))
                  setPresetKey(undefined)
                  setGrants([])
                }}>
                  {superAdmin && <option value="site">Whole site</option>}
                  <option value="tournament">Season / Tournament</option>
                  <option value="campaign">Host Campaign</option>
                </select>
              </Field>
              {scopeType !== 'site' && <Field label="Season or campaign">
                <select required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">Select a scope</option>
                  {scopeChoices.filter((choice) => canEdit(scopeType, choice.id)).map((choice) =>
                    <option value={choice.id} key={choice.id}>{choice.name}</option>,
                  )}
                </select>
              </Field>}
            </FormGrid>
            <fieldset className="people-presets">
              <legend>Role presets</legend>
              <div className="admin-choice-grid">
                {directory.presets.map((preset) => (
                  <button type="button" className="admin-choice-card" key={preset.key} aria-pressed={presetKey === preset.key}
                    onClick={() => {
                      const nextType = preset.scopeTypes.includes(scopeType) ? scopeType : preset.scopeTypes[0]
                      if (nextType !== scopeType) {
                        setScopeType(nextType)
                        setScopeId(defaultScopeIdFor(nextType))
                      } else if (!scopeId && nextType !== 'site') {
                        setScopeId(defaultScopeIdFor(nextType))
                      }
                      setPresetKey(preset.key)
                      setGrants(preset.grants)
                    }}>
                    <strong>{preset.key === 'class_chair' ? 'Host Class Chair' : preset.label}</strong>
                    {presetDescriptions[preset.key] && <span>{presetDescriptions[preset.key]}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
            <details className="people-custom-permissions">
              <summary>Customize individual permissions</summary>
              <div className="people-capabilities-grid">
                {Object.entries(directory.capabilities).filter(([capability]) => scopeType !== 'site' || capability !== 'view_audit_log').map(([capability, actions]) => (
                  <fieldset className="people-capability-card" key={capability}>
                    <legend>{accessLabel(capability)}</legend>
                    <div className="people-actions-row">
                      {actions.filter((action) => capability !== 'view_audit_log' || action !== 'export').map((action) => (
                        <label className="people-checkbox-label" key={action}>
                          <input type="checkbox" checked={grants.some((grant) => grant.capability === capability && grant.actions.includes(action))}
                            onChange={() => toggleAction(capability, action)} />
                          {actionLabel(action)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </details>
            <p aria-live="polite" className="people-summary-line">
              {grants.length ? `${subject} can ${new Intl.ListFormat('en').format(grants.map(describeGrant))} for ${scopeName(scopeType, scopeId)}.` : 'Choose a preset or select actions.'}
            </p>
            <button className="btn primary" disabled={busy || !grants.length || !canEdit(scopeType, scopeId || null)}>Save access</button>
          </form>
        </Panel>
      )}
      <Panel>
        <h2>People directory</h2>
        {directory.users.map((person) => {
          const last = person.superAdmin && person.active && directory.activeSuperAdminCount === 1
          return (
            <article key={person.id} className="people-person-card">
              <h3>{person.fullName}</h3>
              <p>{person.email} · {person.active ? 'Active' : 'Deactivated'}{person.superAdmin ? ' · Super Admin' : ''}</p>
              {scopeGroups(person.email, person.grants, person.campaignMemberships)}
              {superAdmin && <div className="people-chip-row">
                <button className="btn secondary small" disabled={busy || last} onClick={() => {
                  setConfirmRequest({
                    title: person.superAdmin ? 'Demote Super Admin?' : 'Promote to Super Admin?',
                    message: `${person.superAdmin ? 'Remove' : 'Grant'} Super Admin access for ${person.email}?`,
                    confirmLabel: person.superAdmin ? 'Remove Super Admin' : 'Grant Super Admin',
                    destructive: person.superAdmin,
                    onConfirm: () => mutate(() => api.updateUserAccess(person.id, { superAdmin: !person.superAdmin }), 'Super Admin access updated.'),
                  })
                }}>{person.superAdmin ? 'Demote Super Admin' : 'Promote to Super Admin'}</button>
                <button className="btn secondary small" disabled={busy || last} onClick={() => {
                  setConfirmRequest({
                    title: person.active ? 'Deactivate account?' : 'Reactivate account?',
                    message: person.active ? `Deactivate ${person.email}’s account? This blocks sign-in across all seasons and campaigns.` : `Reactivate ${person.email}’s account?`,
                    confirmLabel: person.active ? 'Deactivate account' : 'Reactivate account',
                    destructive: person.active,
                    onConfirm: () => mutate(() => api.updateUserAccess(person.id, { active: !person.active }), 'Account status updated.'),
                  })
                }}>{person.active ? 'Deactivate account' : 'Reactivate account'}</button>
              </div>}
            </article>
          )
        })}
        {[...new Set(directory.pendingInvites.map((grant) => grant.email))].map((pendingEmail) => (
          <article key={pendingEmail} className="people-person-card">
            <h3>{pendingEmail} · Pending</h3>
            <p className="muted" style={{ margin: '0.2rem 0 0.5rem' }}>
              No email is sent automatically — text them the link so they can sign in with this email.
            </p>
            <div className="people-chip-row" style={{ marginBottom: '0.5rem' }}>
              <button type="button" className="btn secondary small" onClick={() => void copyInvite(pendingEmail)}>
                {copiedEmail === pendingEmail ? 'Copied invite!' : 'Copy WhatsApp invite'}
              </button>
            </div>
            {scopeGroups(pendingEmail, directory.pendingInvites.filter((grant) => grant.email === pendingEmail))}
          </article>
        ))}
      </Panel>
      {superAdmin && <details onToggle={(event) => setLegacy(event.currentTarget.open)}>
        <summary>Legacy allowlist and campaign invitations</summary>
        {legacy && <LegacyPeopleAccess />}
      </details>}
      <AdminConfirmDialog request={confirmRequest} busy={busy} onClose={() => setConfirmRequest(null)} />
    </div>
  )
}
