import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { SignInButton, SignOutButton } from '@clerk/clerk-react'
import { tournamentScopedPath } from '../lib/admin'
import { useAuthContext } from '../contexts/AuthContext'
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
  IconTrophy,
  IconUsers,
} from './Icons'
import { LoadingState } from './ui'

type IconComponent = (props: { size?: number; className?: string }) => ReactElement

type NavItem = {
  to: string
  label: string
  icon: IconComponent
  end?: boolean
}

type NavSection = {
  label: string
  items: NavItem[]
}

const sidebarStorageKey = 'fd-alumni-admin-sidebar-collapsed'
const mobileNavId = 'fd-admin-mobile-navigation'

const navSections: NavSection[] = [
  {
    label: 'Command',
    items: [
      { to: '/admin', label: 'Overview', icon: IconDashboard, end: true },
      { to: '/admin/tournaments', label: 'Tournaments', icon: IconTrophy },
    ],
  },
  {
    label: 'Tournament ops',
    items: [
      { to: '/admin/divisions', label: 'Teams', icon: IconUsers },
      { to: '/admin/games', label: 'Games', icon: IconCalendar },
      { to: '/admin/standings', label: 'Standings', icon: IconChart },
    ],
  },
  {
    label: 'Coverage',
    items: [
      { to: '/admin/links', label: 'Links', icon: IconLink },
      { to: '/admin/missing-links', label: 'Missing Links', icon: IconList },
      { to: '/admin/news', label: 'News', icon: IconNewspaper },
      { to: '/admin/media', label: 'Media', icon: IconImage },
      { to: '/admin/sponsors', label: 'Sponsors', icon: IconHandshake },
      { to: '/admin/ingest', label: 'Ingest', icon: IconDatabase },
    ],
  },
]

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
  const to = item.to === '/admin' || item.to === '/admin/tournaments' ? item.to : tournamentScopedPath(item.to, tournamentId)

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

function SidebarContent({ collapsed, tournamentId, userEmail, userName, onNavigate, onToggleCollapse }: { collapsed: boolean; tournamentId: string | null; userEmail: string; userName: string; onNavigate: () => void; onToggleCollapse?: () => void }) {
  const collapseButtonRef = useRef<HTMLButtonElement | null>(null)
  const [collapseTooltipVisible, setCollapseTooltipVisible] = useState(false)
  const collapseLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

  useEffect(() => setCollapseTooltipVisible(false), [collapsed])

  return (
    <nav className="admin-sidebar-inner" aria-label="Admin navigation">
      <div className="admin-sidebar-header">
        <Link to="/admin" className={`admin-brand ${collapsed ? 'collapsed' : ''}`} onClick={onNavigate} title={collapsed ? 'FD Hub Admin' : undefined}>
          <span className="brand-mark">FD</span>
          {!collapsed && <span><strong>Hub Admin</strong><small>Tournament workspace</small></span>}
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
        {navSections.map((section, sectionIndex) => (
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
          <span className="admin-account-avatar">{(userName || userEmail || 'A').charAt(0).toUpperCase()}</span>
          {!collapsed && <span className="admin-account-meta"><strong>{userName || 'Admin'}</strong><small>{userEmail}</small></span>}
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

export function AdminLayout() {
  const auth = useAuthContext()
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

  useEffect(() => {
    if (!mobileOpen || typeof document === 'undefined') return

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
  }, [mobileOpen])

  if (auth.isLoading) return <div className="admin-shell"><LoadingState label="Verifying admin access" /></div>

  if (auth.isClerkEnabled && !auth.isSignedIn) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Admin access</h1>
          <p>Sign in with an allowlisted organizer account to manage tournament data.</p>
          <SignInButton mode="modal" forceRedirectUrl={returnTo}>
            <button className="btn primary">Sign in</button>
          </SignInButton>
        </div>
      </div>
    )
  }

  if (!auth.user?.isStaff) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Access pending</h1>
          <p>{auth.error || 'This account is not on the FD Alumni Hub admin allowlist yet.'}</p>
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
  const userEmail = auth.user.email
  const userName = auth.user.fullName

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
          <span>Tournament workspace</span>
        </div>
        <span className="brand-mark">FD</span>
      </header>

      {mobileOpen && <button type="button" className="admin-mobile-backdrop" onClick={closeMobileNav} aria-label="Close admin navigation" />}
      {mobileOpen && (
        <aside id={mobileNavId} className="admin-sidebar admin-sidebar-mobile open" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button ref={mobileCloseButtonRef} type="button" className="admin-mobile-close" onClick={closeMobileNav} aria-label="Close admin navigation"><IconClose /></button>
          <SidebarContent collapsed={false} tournamentId={tournamentId} userEmail={userEmail} userName={userName} onNavigate={closeMobileNav} />
        </aside>
      )}

      <aside className={`admin-sidebar admin-sidebar-desktop ${desktopCollapsed ? 'collapsed' : ''}`}>
        <SidebarContent collapsed={desktopCollapsed} tournamentId={tournamentId} userEmail={userEmail} userName={userName} onNavigate={() => undefined} onToggleCollapse={() => setDesktopCollapsed((value) => !value)} />
      </aside>

      <section className={`admin-content ${desktopCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="admin-topbar">
          <div className="admin-topbar-icons" aria-hidden="true"><IconCalendar /><IconTrophy /><IconLink /><IconImage /></div>
          <span>{userName}</span>
        </div>
        <Outlet />
      </section>
    </div>
  )
}
