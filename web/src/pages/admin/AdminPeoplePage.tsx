import { useMemo, useState, type FormEvent } from 'react'
import { api } from '../../lib/api'
import { mutationErrorMessage } from '../../lib/errors'
import { useAsync } from '../../lib/hooks'
import type { CampaignRole } from '../../lib/types'
import { EmptyState, ErrorState, Field, FormGrid, LoadingState, PageHeader, Panel, StatusBadge } from '../../components/ui'

const CAMPAIGN_ROLES: CampaignRole[] = ['chair', 'treasurer', 'board']

export function AdminPeoplePage() {
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
  const [wlRole, setWlRole] = useState<'admin' | 'staff'>('staff')
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

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!effectiveCampaignId) return
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

  const handleToggleMembership = async (membershipId: string, nextActive: boolean) => {
    if (!effectiveCampaignId) return
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

  const handleUpdateWhitelist = async (id: string, payload: { active?: boolean; role?: 'admin' | 'staff' }) => {
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
  const memberships = campaignPeopleQuery.data?.memberships || []
  const invitations = campaignPeopleQuery.data?.invitations || []
  const users = campaignPeopleQuery.data?.users || []

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
                        onClick={() => void handleToggleMembership(m.id, !m.active)}
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
                        <button type="button" className="btn secondary small" disabled={busy} onClick={() => void handleRevokeInvitation(inv.id)}>
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
              <select value={wlRole} onChange={(e) => setWlRole(e.target.value as 'admin' | 'staff')}>
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
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={busy}
                  onClick={() => void handleUpdateWhitelist(wl.id, { role: wl.role === 'admin' ? 'staff' : 'admin' })}
                >
                  {wl.role === 'admin' ? 'Set staff' : 'Set admin'}
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={busy}
                  onClick={() => void handleUpdateWhitelist(wl.id, { active: !wl.active })}
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
