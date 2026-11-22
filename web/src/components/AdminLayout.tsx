import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { SignInButton, SignOutButton } from '@clerk/clerk-react'
import { tournamentScopedPath } from '../lib/admin'
import { useAuthContext } from '../contexts/AuthContext'
import { useBackendAvailabilityContext } from '../hooks/useBackendAvailability'
import type { CurrentUser } from '../lib/types'
import {
  IconCalendar,
  IconChart,
  IconClose,
  IconDashboard,
  IconDatabase,
  IconHandshake,
  IconHome,
  IconImage,
  IconLink,
  IconList,
  IconLogOut,
  IconMenu,
  IconNewspaper,
  IconPanelLeftClose,
  IconPanelLeftOpen,
  IconShield,
  IconTicket,
  IconTrophy,
  IconUsers,
} from './Icons'
import { LoadingState, Panel } from './ui'

type IconComponent = (props: { size?: number; className?: string }) => ReactElement

type NavItem = {
  to: string
  label: string
  icon: IconComponent
  end?: boolean
  tournamentScoped?: boolean
  access: 'campaign' | 'staff' | 'admin'
}

type NavSection = {
  label: string
  items: NavItem[]
}

const sidebarStorageKey = 'fd-alumni-admin-sidebar-collapsed'
const mobileNavId = 'fd-admin-mobile-navigation'

const navSections: NavSection[] = [
  {
    label: 'Host Year',
    items: [
      { to: '/admin/campaign/finance', label: 'Finance', icon: IconChart, access: 'campaign' },
      { to: '/admin/campaign/host-year', label: 'Host Year', icon: IconTicket, access: 'campaign' },
    ],
  },
  {
    label: 'Command',
    items: [
      { to: '/admin', label: 'Overview', icon: IconDashboard, end: true, access: 'staff' },
      { to: '/admin/tournaments', label: 'Tournaments', icon: IconTrophy, access: 'staff' },
    ],
  },
  {
    label: 'Tournament ops',
    items: [
      { to: '/admin/divisions', label: 'Teams', icon: IconUsers, tournamentScoped: true, access: 'staff' },
      { to: '/admin/import', label: 'Import', icon: IconDatabase, tournamentScoped: true, access: 'staff' },
      { to: '/admin/games', label: 'Games', icon: IconCalendar, tournamentScoped: true, access: 'staff' },
      { to: '/admin/game-day', label: 'Game Day', icon: IconHome, tournamentScoped: true, access: 'staff' },
      { to: '/admin/standings', label: 'Standings', icon: IconChart, tournamentScoped: true, access: 'staff' },
    ],
  },
  {
    label: 'Coverage',
    items: [
      { to: '/admin/links', label: 'Links', icon: IconLink, tournamentScoped: true, access: 'staff' },
      { to: '/admin/missing-links', label: 'Missing Links', icon: IconList, tournamentScoped: true, access: 'staff' },
      { to: '/admin/news', label: 'News', icon: IconNewspaper, tournamentScoped: true, access: 'staff' },
      { to: '/admin/media', label: 'Media', icon: IconImage, tournamentScoped: true, access: 'staff' },
      { to: '/admin/sponsors', label: 'Sponsors', icon: IconHandshake, tournamentScoped: true, access: 'staff' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/campaigns', label: 'Campaigns', icon: IconTrophy, access: 'admin' },
      { to: '/admin/people', label: 'People & Roles', icon: IconUsers, access: 'admin' },
      { to: '/admin/ingest', label: 'Ingest', icon: IconDatabase, tournamentScoped: true, access: 'admin' },
    ],
  },
]

export function hasCampaignAccess(user: CurrentUser | null | undefined) {
  if (!user) return false
  return user.isAdmin || Boolean(user.campaignMemberships && user.campaignMemberships.length > 0)
}

export function defaultWorkspaceHome(user: CurrentUser | null | undefined) {
  if (user?.isStaff) return '/admin'
  const roles = new Set((user?.campaignMemberships || []).flatMap((m) => m.roles))
  if (roles.has('treasurer') || roles.has('board')) return '/admin/campaign/finance'
  return '/admin/campaign/host-year'
}

function displayUserRole(user: CurrentUser) {
  if (user.isAdmin) return 'Admin'
  if (user.isStaff) return 'Staff'
  const roles = Array.from(new Set((user.campaignMemberships || []).flatMap((m) => m.roles)))
  if (roles.length === 0) return 'Member'
  return roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' · ')
}

function readSidebarPreference() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(sidebarStorageKey) === 'true'
  } catch {
    return false
  }
}

function FloatingTooltip({ anchorRef, label, visible }: { anchorRef: RefObject<HTMLElement | null>; label: string; visible: boolean }) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!visible) return

    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      setPosition({ top: rect.top + rect.height / 2, left: rect.right + 16 })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, visible])

  if (!visible || !position || typeof document === 'undefined') return null

  return createPortal(
    <div className="admin-rail-tooltip" style={{ top: position.top, left: position.left }}>
      <span className="admin-rail-tooltip-arrow" />
      <span className="admin-rail-tooltip-label">{label}</span>
    </div>,
    document.body,
  )
}

function AdminNavLink({ item, collapsed, tournamentId, onNavigate }: { item: NavItem; collapsed: boolean; tournamentId: string | null; onNavigate: () => void }) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const Icon = item.icon
  const to = item.tournamentScoped ? tournamentScopedPath(item.to, tournamentId) : item.to

  useEffect(() => setTooltipVisible(false), [collapsed])

  return (
    <>
      <NavLink
        ref={anchorRef}
        to={to}
        end={item.end}
        onClick={() => {
          setTooltipVisible(false)
          onNavigate()
        }}
        onMouseEnter={() => collapsed && setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => collapsed && setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => `admin-nav-link ${collapsed ? 'collapsed' : ''} ${isActive ? 'active' : ''}`}
      >
        <Icon className="admin-nav-icon" />
        <span className={collapsed ? 'sr-only' : ''}>{item.label}</span>
      </NavLink>
      {collapsed && <FloatingTooltip anchorRef={anchorRef} label={item.label} visible={tooltipVisible} />}
    </>
  )
}

function UtilityLink({ to, label, icon: Icon, collapsed, onNavigate }: { to: string; label: string; icon: IconComponent; collapsed: boolean; onNavigate: () => void }) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => setTooltipVisible(false), [collapsed])

  return (
    <>
      <Link
        ref={anchorRef}
        to={to}
        onClick={() => {
          setTooltipVisible(false)
          onNavigate()
        }}
        onMouseEnter={() => collapsed && setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => collapsed && setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        aria-label={collapsed ? label : undefined}
        title={collapsed ? label : undefined}
        className={`admin-nav-link utility ${collapsed ? 'collapsed' : ''}`}
      >
        <Icon className="admin-nav-icon" />
        <span className={collapsed ? 'sr-only' : ''}>{label}</span>
      </Link>
      {collapsed && <FloatingTooltip anchorRef={anchorRef} label={label} visible={tooltipVisible} />}
    </>
  )
}

function visibleNavSections(user: CurrentUser) {
  const canCampaign = hasCampaignAccess(user)
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.access === 'admin') return user.isAdmin
        if (item.access === 'staff') return user.isStaff
        return canCampaign
      }),
    }))
    .filter((section) => section.items.length > 0)
}

function SidebarContent({
  collapsed,
  tournamentId,
  user,
  onNavigate,
  onToggleCollapse,
}: {
  collapsed: boolean
  tournamentId: string | null
  user: CurrentUser
  onNavigate: () => void
  onToggleCollapse?: () => void
}) {
  const collapseButtonRef = useRef<HTMLButtonElement | null>(null)
  const [collapseTooltipVisible, setCollapseTooltipVisible] = useState(false)
  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'
  const sections = visibleNavSections(user)
  const userRole = displayUserRole(user)
  const homePath = defaultWorkspaceHome(user)
  const subtitle = user.isStaff ? 'Tournament workspace' : 'Host Year workspace'

  useEffect(() => setCollapseTooltipVisible(false), [collapsed])

  return (
    <nav className="admin-sidebar-inner" aria-label="Admin navigation">
      <div className="admin-sidebar-header">
        <Link to={homePath} className={`admin-brand ${collapsed ? 'collapsed' : ''}`} onClick={onNavigate} title={collapsed ? 'FD Hub Admin' : undefined}>
          <span className="brand-mark">FD</span>
          {!collapsed && <span><strong>Hub Admin</strong><small>{subtitle}</small></span>}
        </Link>
        {onToggleCollapse && (
          <>
            <button
              ref={collapseButtonRef}
              type="button"
              className={`admin-collapse-button ${collapsed ? 'collapsed' : ''}`}
              onClick={() => {
                setCollapseTooltipVisible(false)
                onToggleCollapse()
              }}
              onMouseEnter={() => collapsed && setCollapseTooltipVisible(true)}
              onMouseLeave={() => setCollapseTooltipVisible(false)}
              onFocus={() => collapsed && setCollapseTooltipVisible(true)}
              onBlur={() => setCollapseTooltipVisible(false)}
              aria-label={collapseLabel}
              aria-expanded={!collapsed}
              title={collapsed ? collapseLabel : undefined}
            >
              {collapsed ? <IconPanelLeftOpen /> : <IconPanelLeftClose />}
              {!collapsed && <span>{collapseLabel}</span>}
            </button>
            {collapsed && <FloatingTooltip anchorRef={collapseButtonRef} label={collapseLabel} visible={collapseTooltipVisible} />}
          </>
        )}
      </div>

      <div className="admin-sidebar-scroll">
        {sections.map((section, sectionIndex) => (
          <div className="admin-nav-section" key={section.label}>
            {collapsed ? (
              <div className={sectionIndex === 0 ? 'sr-only' : 'admin-nav-divider'}><span className="sr-only">{section.label}</span></div>
            ) : (
              <p>{section.label}</p>
            )}
            <div className="admin-nav-list">
              {section.items.map((item) => <AdminNavLink key={item.to} item={item} collapsed={collapsed} tournamentId={tournamentId} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-sidebar-footer">
        <UtilityLink to="/" label="View public hub" icon={IconHome} collapsed={collapsed} onNavigate={onNavigate} />
        <div className={`admin-account-card ${collapsed ? 'collapsed' : ''}`}>
          <span className="admin-account-avatar">{(user.fullName || user.email || 'A').charAt(0).toUpperCase()}</span>
          {!collapsed && (
            <span className="admin-account-meta">
              <strong>{user.fullName || 'Member'} <span className="admin-role-pill">{userRole}</span></strong>
              <small>{user.email}</small>
            </span>
          )}
        </div>
        <SignOutButton>
          <button className={`admin-signout-button ${collapsed ? 'collapsed' : ''}`} aria-label="Sign out">
            <IconLogOut />
            {!collapsed && <span>Sign out</span>}
          </button>
        </SignOutButton>
      </div>
    </nav>
  )
}

export function RequireAdminRoute({ children }: { children: ReactNode }) {
  const auth = useAuthContext()

  if (!auth.user?.isAdmin) {
    return (
      <div className="page-stack admin-page">
        <Panel className="state-card">
          <IconShield size={32} />
          <h2>Admin access required</h2>
          <p>Only administrators can access system campaign, people, and archive tools.</p>
          <Link className="btn secondary" to={defaultWorkspaceHome(auth.user)}>Back to workspace</Link>
        </Panel>
      </div>
    )
  }

  return <>{children}</>
}

export function RequireStaffRoute({ children }: { children: ReactNode }) {
  const auth = useAuthContext()

  if (!auth.user?.isStaff) {
    return (
      <div className="page-stack admin-page">
        <Panel className="state-card">
          <IconShield size={32} />
          <h2>Tournament staff access required</h2>
          <p>Your account is set up for Host Year campaign access. Tournament operations require a staff or admin role.</p>
          <Link className="btn secondary" to={defaultWorkspaceHome(auth.user)}>Open Host Year workspace</Link>
        </Panel>
      </div>
    )
  }

  return <>{children}</>
}

export function RequireCampaignRoute({ children }: { children: ReactNode }) {
  const auth = useAuthContext()

  if (!hasCampaignAccess(auth.user)) {
    return (
      <div className="page-stack admin-page">
        <Panel className="state-card">
          <IconShield size={32} />
          <h2>Host campaign access required</h2>
          <p>Ask an administrator to invite your email to a Host Year campaign role (chair, treasurer, or board).</p>
          <Link className="btn secondary" to={defaultWorkspaceHome(auth.user)}>Back to workspace</Link>
        </Panel>
      </div>
    )
  }

  return <>{children}</>
}

export function AdminIndexRoute({ staffElement }: { staffElement: ReactNode }) {
  const auth = useAuthContext()
  if (auth.user?.isStaff) return <>{staffElement}</>
  return <Navigate to={defaultWorkspaceHome(auth.user)} replace />
}

export function AdminLayout() {
  const auth = useAuthContext()
  const backend = useBackendAvailabilityContext()
  const location = useLocation()
  const returnTo = `${window.location.pathname}${window.location.search}`
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(readSidebarPreference)
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const tournamentId = new URLSearchParams(location.search).get('tournamentId')

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(sidebarStorageKey, String(desktopCollapsed))
    } catch {
      // Ignore restricted localStorage contexts.
    }
  }, [desktopCollapsed])

  const showUnavailableState = backend.isUnavailable || auth.errorKind === 'network'

  useEffect(() => {
    if (showUnavailableState && mobileOpen) setMobileOpen(false)
  }, [showUnavailableState, mobileOpen])

  useEffect(() => {
    if (!mobileOpen || showUnavailableState || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const opener = mobileMenuButtonRef.current
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => mobileCloseButtonRef.current?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      const mobileNav = document.getElementById(mobileNavId)
      if (document.activeElement instanceof HTMLElement && mobileNav?.contains(document.activeElement)) opener?.focus()
    }
  }, [mobileOpen, showUnavailableState])

  const retryConnection = async () => {
    await backend.retry()
    await auth.refreshUser()
  }

  if (showUnavailableState) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Admin API unavailable</h1>
          <p>The FD Alumni Hub API is currently paused or unreachable. Admin tools require a live API connection.</p>
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={() => void retryConnection()} disabled={backend.isChecking || auth.isLoading}>
              {backend.isChecking || auth.isLoading ? 'Checking…' : 'Retry connection'}
            </button>
            <Link className="btn secondary" to="/">View public hub</Link>
          </div>
        </div>
      </div>
    )
  }

  if (auth.isLoading || backend.isChecking) return <div className="admin-shell"><LoadingState label="Verifying workspace access" /></div>

  if (auth.isClerkEnabled && !auth.isSignedIn) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Organizer &amp; Host Class sign in</h1>
          <p>Sign in with an allowlisted organizer or invited host class board account.</p>
          <SignInButton mode="modal" forceRedirectUrl={returnTo}>
            <button className="btn primary">Sign in</button>
          </SignInButton>
        </div>
      </div>
    )
  }

  const hasAccess = Boolean(auth.user && (auth.user.isStaff || hasCampaignAccess(auth.user)))

  if (!hasAccess || !auth.user) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Access pending</h1>
          <p>{auth.error || 'This account is not on the FD Alumni Hub allowlist or invited to a host class campaign yet.'}</p>
          {auth.isClerkEnabled ? (
            <SignOutButton><button className="btn secondary">Sign out</button></SignOutButton>
          ) : (
            <p className="muted">Configure Clerk before using admin routes.</p>
          )}
        </div>
      </div>
    )
  }

  const closeMobileNav = () => setMobileOpen(false)
  const userName = auth.user.fullName
  const userRole = displayUserRole(auth.user)
  const workspaceSubtitle = auth.user.isStaff ? 'Tournament workspace' : 'Host Year workspace'

  return (
    <div className="admin-shell">
      <header className="admin-mobile-topbar">
        <button
          ref={mobileMenuButtonRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          className="icon-button"
          aria-label="Open admin navigation"
          aria-expanded={mobileOpen}
          aria-controls={mobileNavId}
        >
          <IconMenu />
        </button>
        <div>
          <strong>FD Hub Admin</strong>
          <span>{workspaceSubtitle}</span>
        </div>
        <span className="brand-mark">FD</span>
      </header>

      {mobileOpen && <button type="button" className="admin-mobile-backdrop" onClick={closeMobileNav} aria-label="Close admin navigation" />}
      {mobileOpen && (
        <aside id={mobileNavId} className="admin-sidebar admin-sidebar-mobile open" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button ref={mobileCloseButtonRef} type="button" className="admin-mobile-close" onClick={closeMobileNav} aria-label="Close admin navigation"><IconClose /></button>
          <SidebarContent collapsed={false} tournamentId={tournamentId} user={auth.user} onNavigate={closeMobileNav} />
        </aside>
      )}

      <aside className={`admin-sidebar admin-sidebar-desktop ${desktopCollapsed ? 'collapsed' : ''}`}>
        <SidebarContent collapsed={desktopCollapsed} tournamentId={tournamentId} user={auth.user} onNavigate={() => undefined} onToggleCollapse={() => setDesktopCollapsed((value) => !value)} />
      </aside>

      <section className={`admin-content ${desktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="admin-topbar">
          <div className="admin-topbar-icons" aria-hidden="true"><IconCalendar /><IconTrophy /><IconLink /><IconImage /></div>
          <span>{userName} · {userRole}</span>
        </div>
        <Outlet />
      </section>
    </div>
  )
}
