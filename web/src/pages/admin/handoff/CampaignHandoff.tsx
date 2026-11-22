import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState, Field, LoadingState, Panel } from '../../../components/ui'
import { useAuthContext } from '../../../contexts/AuthContext'
import { hasCapability } from '../../../lib/adminModules'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import { useAsync } from '../../../lib/hooks'
import type { AdminCampaignEvent, AdminHostCampaign, CampaignHandoffStatus } from '../../../lib/types'
import { formatUsd } from '../finance/financeFields'
import { HandoffOfficers } from './HandoffOfficers'
import { PrepareNextYearWizard, hostYearWorkspace } from './PrepareNextYearWizard'
import { TournamentChampionsPanel } from './TournamentChampionsPanel'

const financeHref = (slug: string, tab: string) => `/admin/finance?campaign=${encodeURIComponent(slug)}&tab=${tab}`

export function CampaignHandoff({ campaign, events, preparing, onPrepare, onCloseWizard, onCampaignChange }: {
  campaign: AdminHostCampaign
  events: AdminCampaignEvent[]
  preparing: boolean
  onPrepare: () => void
  onCloseWizard: () => void
  onCampaignChange: () => Promise<void>
}) {
  const { user } = useAuthContext()
  const status = useAsync(() => api.adminCampaignHandoffStatus(campaign.id), [campaign.id])

  if (!status.data) {
    return status.error
      ? <ErrorState message={status.error} onRetry={status.reload} />
      : <LoadingState label="Loading handoff checklists" />
  }

  const { closeout, onboarding, relatedNextCampaign, canPrepareNextYear, campaign: summary } = status.data
  const tournamentScope = { type: 'tournament', id: summary.tournamentId }
  const canViewChampions = hasCapability(user, 'history_and_media', 'view', tournamentScope)
  const canConfirmChampions = hasCapability(user, 'history_and_media', 'confirm_champions', tournamentScope)
  const canViewSiteMode = hasCapability(user, 'site_mode_and_settings', 'view')
  const canPublishRecap = canViewSiteMode && hasCapability(user, 'site_mode_and_settings', 'publish')
  const canViewFinance = hasCapability(user, 'finance_and_reimbursements', 'view', { type: 'campaign', id: summary.id })
  const canScore = hasCapability(user, 'scores_and_stats', 'view', tournamentScope)

  async function reloadCampaign() {
    await Promise.all([status.reload(), onCampaignChange()])
  }

  return (
    <div className="page-stack campaign-handoff">
      {status.error && <ErrorState message={status.error} onRetry={status.reload} />}
      {preparing && canPrepareNextYear && !relatedNextCampaign && <PrepareNextYearWizard source={summary} onCreated={onCampaignChange} onClose={() => {
        onCloseWizard()
        void reloadCampaign()
      }} />}
      {relatedNextCampaign && <Panel>
        <h2>Next host year</h2>
        <p>{relatedNextCampaign.title} · {relatedNextCampaign.tournamentYear} · {relatedNextCampaign.status}</p>
        {relatedNextCampaign.hasAccess && (hasCapability(user, 'fundraisers_and_sponsors', 'view', { type: 'campaign', id: relatedNextCampaign.id })
          ? <Link className="btn secondary" to={hostYearWorkspace(relatedNextCampaign.slug, 'handoff')}>Open incoming year workspace</Link>
          : <Link className="btn secondary" to={financeHref(relatedNextCampaign.slug, 'ledger')}>Open incoming year finance</Link>)}
      </Panel>}
      {summary.status !== 'draft' && <Panel className="page-stack">
        <div className="section-heading">
          <h2>Class of {summary.hostClassYear} closeout</h2>
          <button type="button" className="btn secondary small" disabled={status.loading} onClick={() => void status.reload()}>Refresh checklist</button>
        </div>
        <CloseoutChecklist status={status.data} canViewFinance={canViewFinance} canScore={canScore} canOpenChampions={canViewChampions || canConfirmChampions} />
        {canPrepareNextYear && summary.status !== 'archived' && (
          <ArchiveCampaign campaignId={summary.id} blocked={closeout.blockers.length > 0} onArchived={reloadCampaign} />
        )}
      </Panel>}
      {(canViewChampions || canConfirmChampions) && summary.status !== 'draft' && (
        <section id="division-champions">
          <TournamentChampionsPanel tournamentId={summary.tournamentId} canView={canViewChampions} canConfirm={canConfirmChampions}
            canPublishRecap={canPublishRecap} onChanged={status.reload} />
        </section>
      )}
      {!preparing && !relatedNextCampaign && canPrepareNextYear && summary.status !== 'draft' && (
        <div><button className="btn primary" type="button" onClick={onPrepare}>Prepare Class of {summary.hostClassYear + 1}</button></div>
      )}
      {onboarding && <OnboardingChecklist campaign={campaign} events={events} status={onboarding}
        canPublish={canPrepareNextYear} canViewFinance={canViewFinance}
        canViewSiteMode={canViewSiteMode} onPublished={reloadCampaign} />}
    </div>
  )
}

function CloseoutChecklist({ status, canViewFinance, canScore, canOpenChampions }: {
  status: CampaignHandoffStatus
  canViewFinance: boolean
  canScore: boolean
  canOpenChampions: boolean
}) {
  const { campaign, closeout } = status
  const labels = {
    unfinalized_games: 'Unresolved games',
    pending_reimbursements: 'Pending reimbursements',
    missing_receipts: 'Expenses missing receipts',
    open_cash_pledges: 'Open cash pledges',
    champions_confirmed: 'Division champions confirmed',
    board_report_ready: 'Board Final Report ready',
    archive: 'Campaign archived',
  }
  const links = {
    unfinalized_games: canScore ? `/admin/scorekeeper?tournamentId=${campaign.tournamentId}&view=missing` : null,
    pending_reimbursements: canViewFinance ? financeHref(campaign.slug, 'reimbursements') : null,
    missing_receipts: canViewFinance ? financeHref(campaign.slug, 'ledger') : null,
    open_cash_pledges: canViewFinance ? financeHref(campaign.slug, 'pledges') : null,
    champions_confirmed: null,
    board_report_ready: canViewFinance ? financeHref(campaign.slug, 'report') : null,
    archive: null,
  }

  return (
    <ul className="handoff-list" aria-label="Outgoing closeout checklist">
      {closeout.checklist.map(({ code, complete, severity, count }) => (
        <li key={code} className="compact-admin-row">
          <div>
            <strong>{labels[code]}{count !== null && ` (${count})`}</strong>
            <p className="muted">{complete ? 'Complete' : severity === 'blocker' ? 'Blocks archive' : severity === 'warning' ? 'Warning' : code === 'board_report_ready' ? 'Review open closeout blockers' : 'Open for closeout'}</p>
          </div>
          {links[code] && <Link className="btn secondary small" to={links[code]!}>{code === 'board_report_ready' ? 'Open board report' : `Review ${labels[code].toLowerCase()}`}</Link>}
          {code === 'champions_confirmed' && canOpenChampions && <a className="btn secondary small" href="#division-champions">Review division champions</a>}
        </li>
      ))}
    </ul>
  )
}

function ArchiveCampaign({ campaignId, blocked, onArchived }: { campaignId: string; blocked: boolean; onArchived: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function archive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      await api.adminArchiveCampaign(campaignId, {
        completeTournament: data.has('completeTournament'),
        forceReason: String(data.get('reason') ?? '').trim() || null,
      })
      setConfirming(false)
      await onArchived()
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to archive campaign'))
    } finally {
      setBusy(false)
    }
  }

  return confirming ? (
    <form className="page-stack" onSubmit={archive}>
      <p>Archiving closes the outgoing campaign for edits and preserves board access to the ledger and reports.</p>
      {blocked && <Field label="Audited override reason"><textarea name="reason" required minLength={5} rows={2} /></Field>}
      <label className="check-field"><input name="completeTournament" type="checkbox" defaultChecked /> Mark the outgoing tournament completed</label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions handoff-actions">
        <button className="btn danger" type="submit" disabled={busy}>{busy ? 'Archiving…' : 'Confirm archive'}</button>
        <button className="btn secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </form>
  ) : <div><button className="btn secondary" type="button" onClick={() => { setError(''); setConfirming(true) }}>Archive campaign</button></div>
}

function OnboardingChecklist({ campaign, events, status, canPublish, canViewFinance, canViewSiteMode, onPublished }: {
  campaign: AdminHostCampaign
  events: AdminCampaignEvent[]
  status: NonNullable<CampaignHandoffStatus['onboarding']>
  canPublish: boolean
  canViewFinance: boolean
  canViewSiteMode: boolean
  onPublished: () => Promise<void>
}) {
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const finance = financeHref(campaign.slug, 'ledger')
  const content = hostYearWorkspace(campaign.slug, 'settings')
  const eventList = hostYearWorkspace(campaign.slug, 'events')

  async function publish() {
    if (publishing) return
    setPublishing(true)
    setError('')
    try {
      await api.adminUpdateCampaign(campaign.id, { status: 'active' })
      await onPublished()
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to publish fundraiser'))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Panel className="page-stack">
      <h2>Incoming year onboarding</h2>
      <ul className="handoff-list" aria-label="Incoming onboarding checklist">
        <li className="compact-admin-row">
          <div><strong>Confirm FDAA funding assumptions</strong>
            <p className="muted">{status.fundingAssumptionsPresent
              ? `${formatUsd(campaign.fdaaUpfrontCents)} upfront · ${campaign.fdaaTicketShareBps / 100}% ticket share`
              : 'Funding assumptions still needed'}</p>
          </div>
          {canViewFinance && <Link className="btn secondary small" to={finance}>Review finance settings</Link>}
        </li>
        <li><strong>Invite incoming officers and verify acceptance</strong><HandoffOfficers officers={status.officers} /></li>
        <OnboardingItem title="Set public campaign copy and fundraising goal" complete={status.publicCopyConfigured && status.goalConfigured} href={content} action="Edit campaign copy" />
        <OnboardingItem title="Set donation and ticket links" complete={status.donationLinkSet && status.ticketLinksSet} href={content} action="Review links" />
        <OnboardingItem title="Schedule the first fundraiser" complete={status.firstFundraiserScheduled} href={eventList}
          action={status.firstFundraiserCreated ? 'Set event date' : 'Add fundraiser'} />
        <li>
          <strong>Preview and publish the incoming fundraiser</strong>
          <p className="muted">{status.published ? (status.featured ? 'Published · featured' : 'Published') : 'Private draft'}</p>
          <p>Publishing the incoming fundraiser is independent of archiving the outgoing year’s finances.</p>
        </li>
      </ul>
      {status.published ? (
        <div className="row-actions handoff-actions">
          <Link className="btn secondary" to={`/host-year/${encodeURIComponent(campaign.slug)}`}>View public fundraiser page</Link>
          {canViewSiteMode && <Link className="btn secondary" to={`/admin/site-mode?mode=fundraising&hostCampaignId=${campaign.id}`}>Preview fundraiser in Site Mode</Link>}
        </div>
      ) : <details className="entry-details">
        <summary>Preview fundraiser page</summary>
        <div className="state-card">
          <h3>{campaign.title}</h3>
          {campaign.tagline && <p>{campaign.tagline}</p>}
          <p>{campaign.description || 'Add a campaign description before publishing.'}</p>
          {campaign.publicMeterEnabled && <p>Fundraising goal {formatUsd(campaign.goalCents)}</p>}
          {campaign.donationUrl && <p>Donation link configured</p>}
          <h4>Public events</h4>
          {events.some((event) => event.publicVisible && !event.archivedAt)
            ? <ul>{events.filter((event) => event.publicVisible && !event.archivedAt).map((event) => <li key={event.id}>{event.title}</li>)}</ul>
            : <p>No public events yet.</p>}
        </div>
        {canPublish && <button className="btn primary" type="button" disabled={publishing} onClick={() => void publish()}>
          {publishing ? 'Publishing…' : 'Publish fundraiser page'}
        </button>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </details>}
    </Panel>
  )
}

function OnboardingItem({ title, complete, href, action }: { title: string; complete: boolean; href: string; action: string }) {
  return (
    <li className="compact-admin-row">
      <div><strong>{title}</strong><p className="muted">{complete ? 'Complete' : 'Needs attention'}</p></div>
      <Link className="btn secondary small" to={href}>{action}</Link>
    </li>
  )
}
