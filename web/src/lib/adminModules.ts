import { IconCalendar, IconChart, IconDashboard, IconHandshake, IconHome, IconList, IconNewspaper, IconTrophy, IconUsers } from '../components/Icons'
import type { CurrentUser } from './types'

type Tab = { path: string; label: string; capability?: string; action?: string; superAdmin?: boolean }
type Module = Tab & {
  key: string
  icon: typeof IconHome
  tournamentScoped?: boolean
  tabs?: Tab[]
}

const schedule = 'schedule_and_teams'
const results = 'scores_and_stats'
const fundraising = 'fundraisers_and_sponsors'
const history = 'history_and_media'

export const adminModules: Module[] = [
  { key: 'work', path: '/admin', label: 'Overview', icon: IconDashboard },
  { key: 'game-day', path: '/admin/game-day', label: 'Game Night', icon: IconHome, capability: 'tonights_menu_and_news', tournamentScoped: true },
  { key: 'games', path: '/admin/games', label: 'Schedule & Teams', icon: IconCalendar, capability: schedule, tournamentScoped: true, tabs: [
    { path: '/admin/games', label: 'Games' },
    { path: '/admin/divisions', label: 'Teams & Divisions' },
    { path: '/admin/import', label: 'Import', action: 'import' },
    { path: '/admin/links', label: 'Tickets & Streams' },
    { path: '/admin/missing-links', label: 'Missing Links' },
    { path: '/admin/tournaments', label: 'Tournaments' },
  ] },
  { key: 'scorekeeper', path: '/admin/scorekeeper', label: 'Scores & Standings', icon: IconTrophy, capability: results, tournamentScoped: true, tabs: [
    { path: '/admin/scorekeeper', label: 'Enter Results', capability: results },
    { path: '/admin/standings', label: 'Standings', capability: results },
  ] },
  { key: 'campaign/host-year', path: '/admin/campaign/host-year', label: 'Host Year', icon: IconHandshake, capability: fundraising, tabs: [
    { path: '/admin/campaign/host-year', label: 'Campaign Workspace' },
    { path: '/admin/campaigns', label: 'All Campaigns', superAdmin: true },
    { path: '/admin/sponsors', label: 'Sponsors' },
  ] },
  { key: 'campaign/finance', path: '/admin/campaign/finance', label: 'Board Finance', icon: IconChart, capability: 'finance_and_reimbursements' },
  { key: 'news', path: '/admin/news', label: 'Coverage & Media', icon: IconNewspaper, capability: history, tournamentScoped: true, tabs: [
    { path: '/admin/news', label: 'Articles' },
    { path: '/admin/media', label: 'Photos & Videos' },
    { path: '/admin/ingest', label: 'Review Links', superAdmin: true },
  ] },
  { key: 'site-mode', path: '/admin/site-mode', label: 'Site Mode', icon: IconHome, capability: 'site_mode_and_settings' },
  { key: 'people', path: '/admin/people', label: 'People & Access', icon: IconUsers, capability: 'manage_admins' },
  { key: 'audit', path: '/admin/audit', label: 'Activity Log', icon: IconList, capability: 'view_audit_log' },
]

export function hasCapability(user: CurrentUser | null | undefined, capability: string, action?: string, scope?: { type: string; id: string }) {
  if (!user || user.active === false) return false
  if (user.isSuperAdmin ?? user.isAdmin) return true
  if (user.capabilities) return user.capabilities.some((entry) =>
    (capability !== 'site_mode_and_settings' || entry.allScopes) &&
    entry.capability === capability && (!action || entry.actions.includes(action)) &&
    (!scope || entry.allScopes || (entry.scopeType === scope.type && entry.scopeIds.includes(scope.id))),
  )
  if (capability === results && (user.isScorekeeper || user.canScoreGames)) return true
  if (user.isStaff && ['tonights_menu_and_news', schedule, results, 'brackets', fundraising, history].includes(capability)) return true
  return [fundraising, 'finance_and_reimbursements'].includes(capability) && Boolean(user.campaignMemberships?.length)
}

export function visibleAdminModules(user: CurrentUser | null | undefined) {
  const visible = adminModules.slice(1).filter((module) => hasCapability(user, module.capability!, module.key === 'site-mode' ? 'view' : undefined) ||
    (module.key === 'scorekeeper' && hasCapability(user, 'brackets')))
  const tasks = visible.filter((module) => !['people', 'audit'].includes(module.key))
  const campaignOnly = tasks.every((module) => module.key.startsWith('campaign/'))
  return user && ((user.isSuperAdmin ?? user.isAdmin) || user.isStaff || (tasks.length > 1 && !campaignOnly)) ? [adminModules[0], ...visible] : visible
}

export function defaultWorkspaceHome(user: CurrentUser | null | undefined) {
  if (user?.defaultWorkspacePath) return user.defaultWorkspacePath
  const modules = visibleAdminModules(user)
  if (modules[0]?.key === 'work') return '/admin'
  const canEditFundraisers = hasCapability(user, fundraising, 'edit')
  const canRecordFinance = hasCapability(user, 'finance_and_reimbursements', 'record')
  if (modules.some((module) => module.key === 'campaign/host-year') && canEditFundraisers && !canRecordFinance) {
    return '/admin/campaign/host-year'
  }
  if (modules.some((module) => module.key === 'campaign/finance')) return '/admin/campaign/finance'
  if (modules[0]?.key === 'scorekeeper' && !canOpenAdminRoute(user, modules[0].path)) return '/admin/standings'
  return modules.find((module) => !['people', 'audit'].includes(module.key))?.path ?? modules[0]?.path ?? '/'
}

export function adminRoute(path: string) {
  const normalized = path.startsWith('/admin/tournaments/') ? '/admin/tournaments' : path.replace(/\/+$/, '')
  const module = adminModules.find((entry) => entry.path === normalized || entry.tabs?.some((tab) => tab.path === normalized))
  return { module, tab: module?.tabs?.find((tab) => tab.path === normalized) }
}

export function canOpenAdminRoute(user: CurrentUser | null | undefined, path: string, tournamentId?: string | null) {
  path = path.toLowerCase().replace(/\/+$/, '')
  if (path === '/admin/tournaments/setup') return Boolean(user?.isSuperAdmin ?? user?.isAdmin)
  const { module, tab } = adminRoute(path)
  if (!module?.capability) return false
  if (tab?.superAdmin && !(user?.isSuperAdmin ?? user?.isAdmin)) return false
  const capability = tab?.capability || module.capability
  if (['/admin/sponsors', '/admin/campaigns'].includes(path) && user?.capabilities && !user.isSuperAdmin) {
    return user.capabilities.some((entry) => entry.capability === capability && (entry.allScopes || entry.scopeType === (path === '/admin/sponsors' ? 'tournament' : 'campaign')) && entry.actions.includes('view'))
  }
  const detailMatch = path.match(/^\/admin\/tournaments\/(\d+)$/)
  const resolvedTournamentId = detailMatch ? detailMatch[1] : tournamentId
  const scope = resolvedTournamentId && module.tournamentScoped ? { type: 'tournament', id: resolvedTournamentId } : undefined
  return hasCapability(user, capability, tab?.action || 'view', scope) ||
    (path === '/admin/standings' && hasCapability(user, 'brackets', 'view', scope))
}
