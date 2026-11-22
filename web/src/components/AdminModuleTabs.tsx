import { NavLink } from 'react-router-dom'
import { adminRoute, canOpenAdminRoute } from '../lib/adminModules'
import { tournamentScopedPath } from '../lib/admin'
import type { CurrentUser } from '../lib/types'

export function AdminModuleTabs({ path, user, tournamentId }: { path: string; user: CurrentUser; tournamentId: string | null }) {
  const { module } = adminRoute(path)
  const tabs = module?.tabs?.filter((tab) => canOpenAdminRoute(user, tab.path)) ?? []
  if (tabs.length < 2) return null

  return (
    <nav aria-label={module?.label} className="mb-5 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
      {tabs.map((tab) => (
        <NavLink key={tab.path} end to={module?.tournamentScoped && canOpenAdminRoute(user, tab.path, tournamentId) ? tournamentScopedPath(tab.path, tournamentId) : tab.path}
          className={({ isActive }) => `rounded px-3 py-2 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
