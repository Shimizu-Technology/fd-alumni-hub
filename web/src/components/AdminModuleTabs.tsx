import { NavLink } from 'react-router-dom'
import { adminRoute, canOpenAdminRoute } from '../lib/adminModules'
import { tournamentScopedPath } from '../lib/admin'
import type { CurrentUser } from '../lib/types'

export function AdminModuleTabs({ path, user, tournamentId }: { path: string; user: CurrentUser; tournamentId: string | null }) {
  const { module } = adminRoute(path)
  const tabs = module?.tabs?.filter((tab) => canOpenAdminRoute(user, tab.path)) ?? []
  if (tabs.length < 2) return null

  return (
    <nav aria-label={module?.label} className="admin-module-tabs">
      {tabs.map((tab) => (
        <NavLink key={tab.path} end to={module?.tournamentScoped && canOpenAdminRoute(user, tab.path, tournamentId) ? tournamentScopedPath(tab.path, tournamentId) : tab.path}
          className={({ isActive }) => `admin-module-tab${isActive ? ' is-active' : ''}`}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
