import { Link } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'
import { hasCapability, visibleAdminModules } from '../../lib/adminModules'
import { siteModes } from '../../lib/siteMode'
import type { CurrentUser } from '../../lib/types'
import { formatUsd } from './finance/financeFields'
import { api } from '../../lib/api'
import { useAsync } from '../../lib/hooks'
import { EmptyState, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../../components/ui'

const financeCapability = 'finance_and_reimbursements'
const fundraiserCapability = 'fundraisers_and_sponsors'

const moduleDescriptions: Record<string, string> = {
  'game-day': 'Update the nightly menu, photos, announcements, and alerts.',
  games: 'Manage seasons, divisions, schedules, tickets, and streams.',
  scorekeeper: 'Manage tournament results, standings, and brackets.',
  'campaign/host-year': 'Organize campaign events, sponsors, and class news.',
  'campaign/finance': 'Review income, expenses, pledges, and reimbursements.',
  news: 'Manage articles, photos, and videos.',
  'site-mode': 'Preview and publish the seasonal homepage.',
  people: 'Invite organizers and manage scoped access.',
  audit: 'Review who changed what and when.',
}

function hasCampaignCapability(user: CurrentUser | null | undefined, capability: string) {
  if (!user || user.active === false) return false
  if (user.isSuperAdmin ?? user.isAdmin) return true
  if (!user.capabilities) return hasCapability(user, capability, 'view')
  return user.capabilities.some((entry) =>
    entry.capability === capability &&
    entry.actions.includes('view') &&
    (entry.allScopes || (entry.scopeType === 'campaign' && entry.scopeIds.length > 0)),
  )
}

export function AdminOverviewPage() {
  const { user } = useAuthContext()
  const modules = visibleAdminModules(user).filter((module) => module.key !== 'work')
  const canViewFinance = hasCampaignCapability(user, financeCapability)
  const canViewFundraisers = hasCampaignCapability(user, fundraiserCapability)
  const canViewSiteMode = hasCapability(user, 'site_mode_and_settings', 'view')
  const hasTopStatus = Boolean(user && (canViewFinance || canViewFundraisers || canViewSiteMode))
  const showTournamentOps = Boolean((user?.isSuperAdmin ?? user?.isAdmin) || (user?.isStaff && !user.capabilities))
  const siteModeQuery = useAsync(
    () => (canViewSiteMode ? api.publicSiteMode() : Promise.resolve(null)),
    [canViewSiteMode],
  )
  const currentMode = siteModeQuery.data?.siteMode.mode ?? null
  const scopeKey = user ? `${user.id}:${JSON.stringify(user.capabilities ?? user.campaignMemberships ?? '')}` : ''

  return (
    <div className="page-stack admin-page">
      <PageHeader title={user?.firstName ? `Welcome, ${user.firstName}` : 'Overview'} description="Live status and priority actions for your workspace." />
      {hasTopStatus && user && (
        <div className="admin-overview-grid">
          {canViewFinance && <FinanceStatus key={`finance:${scopeKey}`} user={user} />}
          {canViewFundraisers && <FundraiserStatus key={`fundraisers:${scopeKey}`} user={user} showPublicProgress={!canViewFinance} />}
          {canViewSiteMode && <SiteModeStatus mode={currentMode} loading={siteModeQuery.loading} />}
        </div>
      )}
      {!hasTopStatus && modules.length > 0 && (
        <section className="page-stack" aria-labelledby="workspace-quick-jump">
          <h2 id="workspace-quick-jump" className="admin-section-title">Your workspace</h2>
          <div className="admin-overview-grid">
            {modules.map(({ key, path, label, icon: Icon }) => (
              <Link key={key} className="panel admin-work-link" to={key === 'scorekeeper' && !hasCapability(user, 'scores_and_stats', 'view') ? '/admin/standings' : path}>
                <Icon size={20} />
                <span><strong>{label}</strong><small>{moduleDescriptions[key]}</small></span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {showTournamentOps && <TournamentOverview siteMode={currentMode} />}
    </div>
  )
}

async function activeCampaignFor(user: CurrentUser, capability: string) {
  const pick = <T extends { status: string }>(campaigns: T[]) =>
    campaigns.find((campaign) => campaign.status === 'active') ?? campaigns.find((campaign) => campaign.status === 'closing')
  if (!user.capabilities && !(user.isSuperAdmin ?? user.isAdmin)) {
    const membership = pick(user.campaignMemberships ?? [])
    return membership && { id: membership.campaignId, slug: membership.campaignSlug, title: membership.campaignTitle, status: membership.status }
  }
  const { campaigns } = await api.adminCampaignWorkspace(capability)
  return pick(campaigns.filter(({ id }) => hasCapability(user, capability, 'view', { type: 'campaign', id })))
}

function FinanceStatus({ user }: { user: CurrentUser }) {
  const query = useAsync(async () => {
    const campaign = await activeCampaignFor(user, financeCapability)
    if (!campaign) return null
    return api.campaignFinanceSummary(campaign.slug)
  }, [user])
  const result = query.error ? null : query.data
  const canRecord = result && result.campaign.status !== 'archived' && (user.capabilities
    ? hasCapability(user, financeCapability, 'record', { type: 'campaign', id: result.campaign.id })
    : (user.isSuperAdmin ?? user.isAdmin) || result.roles.includes('treasurer'))
  const financePath = result ? `/admin/campaign/finance?campaign=${encodeURIComponent(result.campaign.slug)}` : '/admin/campaign/finance'

  return (
    <>
      <Panel className="admin-overview-status">
        <h2>Fundraising progress</h2>
        {result ? <>
          <div>
            <p className="admin-kpi-value">{formatUsd(result.summary.raisedCents)} <small>/ {formatUsd(result.summary.goalCents)}</small></p>
            <p className="muted">{result.campaign.title}</p>
          </div>
        </> : <p className="muted">{query.loading ? 'Loading campaign totals…' : query.error ? 'Campaign totals are unavailable.' : 'No active campaign.'}</p>}
        <Link className={`btn ${canRecord ? 'primary' : 'secondary'}`} to={canRecord ? `${financePath}&action=income` : financePath}>{canRecord ? 'Record money' : 'Open finance workspace'}</Link>
      </Panel>
      {result && <Panel className="admin-overview-status">
        <h2>Pending reimbursements</h2>
        <p className="admin-kpi-value">{result.summary.pendingReimbursementsCount}</p>
        <Link className="btn secondary" to={`${financePath}&tab=reimbursements`}>View reimbursements</Link>
      </Panel>}
    </>
  )
}

function FundraiserStatus({ user, showPublicProgress }: { user: CurrentUser; showPublicProgress: boolean }) {
  const query = useAsync(async () => {
    const campaign = await activeCampaignFor(user, fundraiserCapability)
    if (!campaign || !showPublicProgress) return { campaign, meter: null }
    try {
      const { campaign: settings } = await api.campaignSettings(campaign.slug)
      return { campaign, meter: settings.meter.enabled ? settings.meter : null }
    } catch {
      return { campaign, meter: null }
    }
  }, [user, showPublicProgress])
  const { campaign, meter } = query.data ?? {}
  const selector = campaign ? `&campaign=${encodeURIComponent(campaign.slug)}` : ''
  return <Panel className="admin-overview-status">
    <h2>{meter ? 'Fundraising progress' : 'Campaign events'}</h2>
    <div>
      {meter && <p className="admin-kpi-value">{formatUsd(meter.raisedCents)} <small>/ {formatUsd(meter.goalCents)}</small></p>}
      <p className="muted">{campaign?.title ?? (query.loading ? 'Loading campaign…' : query.error ? 'Campaign details are unavailable.' : 'No active campaign.')}</p>
    </div>
    <Link className="btn primary" to={`/admin/campaign/host-year?tab=events${selector}`}>Manage fundraisers</Link>
  </Panel>
}

function SiteModeStatus({ mode, loading }: { mode: keyof typeof siteModes | null; loading: boolean }) {
  return <Panel className="admin-overview-status">
    <h2>Active site mode</h2>
    <p>{mode ? <span className="admin-live-badge">{siteModes[mode]}</span> : <span className="muted">{loading ? 'Loading site mode…' : 'Site mode is unavailable.'}</span>}</p>
    <Link className="btn primary" to="/admin/site-mode">Change site mode</Link>
  </Panel>
}

function TournamentOverview({ siteMode }: { siteMode: keyof typeof siteModes | null }) {
  const { data, loading, error, reload } = useAsync(() => api.adminDashboard(), [])

  if (loading) return <LoadingState label="Loading admin dashboard" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <EmptyState title="Dashboard unavailable" />

  const isOffSeasonEmpty = siteMode === 'fundraising' && (data.counts.games || 0) === 0 && (data.counts.teams || 0) === 0

  if (isOffSeasonEmpty) {
    return (
      <Panel className="admin-offseason-ops">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div>
            <h2>{data.tournament ? `${data.tournament.year} tournament operations` : 'Tournament operations'}</h2>
            <p className="muted" style={{ margin: '0.2rem 0 0' }}>Off-season fundraising mode — teams, schedule, and live game-night tools activate once tournament setup begins.</p>
          </div>
          <Link className="btn secondary small" to="/admin/tournaments">Open tournament setup →</Link>
        </div>
      </Panel>
    )
  }

  return (
    <section className="page-stack" aria-labelledby="tournament-operations">
      <h2 id="tournament-operations" className="admin-section-title">Tournament operations</h2>

      <div className="stats-grid four">
        <StatCard label="Teams" value={data.counts.teams || 0} tone="maroon" />
        <StatCard label="Games" value={data.counts.games || 0} />
        <StatCard label="Final games" value={data.counts.finalGames || 0} tone="gold" />
        <StatCard label="Coverage links" value={data.counts.articles || 0} />
      </div>

      <div className="split-grid">
        <Panel>
          <div className="section-heading"><h2>Data health</h2><Link to="/admin/missing-links">Review</Link></div>
          <div className="health-grid">
            <div><strong>{data.missing.scores}</strong><span>Final games missing scores</span></div>
            <div><strong>{data.missing.streams}</strong><span>Games missing streams</span></div>
            <div><strong>{data.missing.tickets}</strong><span>Games missing tickets</span></div>
          </div>
        </Panel>
        <Panel>
          <div className="section-heading"><h2>Latest coverage</h2><Link to="/admin/news">Manage</Link></div>
          {data.recentArticles.length === 0 ? <EmptyState title="No articles" /> : (
            <div className="compact-list">
              {data.recentArticles.map((article) => <a key={article.id} className="compact-row" href={article.url} target="_blank" rel="noreferrer"><span>{article.source}</span><strong>{article.title}</strong></a>)}
            </div>
          )}
        </Panel>
      </div>
    </section>
  )
}
