import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  IconCalendar,
  IconChart,
  IconClose,
  IconHome,
  IconMenu,
  IconShield,
  IconTicket,
} from './Icons'
import { externalHref } from '../lib/urls'
import { SiteModeProvider, useSiteMode } from '../contexts/SiteModeContext'
import { useBackendAvailabilityContext } from '../hooks/useBackendAvailability'

const publicMenuId = 'fd-public-mobile-menu'
const menuFocusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/host-year', label: 'Fundraisers' },
  { to: '/today', label: 'Today' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/teams', label: 'Teams' },
  { to: '/bracket', label: 'Bracket' },
  { to: '/standings', label: 'Standings' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/watch', label: 'Watch' },
  { to: '/info', label: 'Info' },
  { to: '/news', label: 'News' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/history', label: 'History' },
  { to: '/sponsors', label: 'Sponsors' },
]

const bottomIcons = { '/': IconHome, '/today': IconCalendar, '/schedule': IconCalendar, '/tickets': IconTicket, '/history': IconChart }

export function PublicLayout() {
  return <SiteModeProvider><PublicShell /></SiteModeProvider>
}

function PublicShell() {
  const [open, setOpen] = useState(false)
  const { siteMode, alerts, homeAlertsInline } = useSiteMode()
  const location = useLocation()
  const backend = useBackendAvailabilityContext()
  const showLayoutAlerts = location.pathname !== '/' || !homeAlertsInline
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuPanelRef = useRef<HTMLDivElement | null>(null)
  const bottomNavItems = siteMode.mobileBottomNav.filter((item) => item.to !== null)

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0)
    const focusableElements = () => Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>(menuFocusableSelector) || [])

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = focusableElements()
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (!first || !last) {
        event.preventDefault()
        menuPanelRef.current?.focus({ preventScroll: true })
        return
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true })
    }
  }, [open])

  const moreActive = open || !bottomNavItems.some(({ to }) => to === location.pathname || (to !== '/' && location.pathname.startsWith(`${to}/`)))

  return (
    <div className="site-shell">
      <header className="site-header">
        <NavLink to="/" className="brand public-brand" onClick={() => setOpen(false)}>
          <span className="brand-crest" aria-hidden="true"><img src="/brand/fd-crest.png" alt="" /></span>
          <span>
            <strong>FD Alumni Basketball Hub</strong>
            <small>Central Tournament Hub</small>
          </span>
        </NavLink>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {siteMode.navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
        </nav>
      </header>

      {open && (
        <div className="mobile-menu" role="presentation">
          <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
          <div ref={menuPanelRef} id={publicMenuId} className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Site menu" tabIndex={-1}>
            <div className="mobile-menu-head">
              <span className="brand-crest" aria-hidden="true"><img src="/brand/fd-crest.png" alt="" /></span>
              <span><strong>FD Alumni Basketball Hub</strong><small>Central Tournament Hub</small></span>
              <button ref={closeButtonRef} className="icon-button" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><IconClose /></button>
            </div>
            <nav className="mobile-menu-links" aria-label="Full menu navigation">
              {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}>{item.label}</NavLink>)}
            </nav>
            <NavLink className="mobile-admin-link" to="/admin" onClick={() => setOpen(false)}><IconShield size={16} /> Organizer sign in</NavLink>
          </div>
        </div>
      )}

      <main className="site-main">
        {backend.isUnavailable && (
          <div className="api-status-banner" role="status">
            <div>
              <strong>Live tournament services are currently paused or unreachable.</strong>
              <span>Historical champions and tournament info remain available while live schedules and scores are offline.</span>
            </div>
            <button type="button" className="btn secondary small" onClick={() => void backend.retry()} disabled={backend.isChecking}>
              {backend.isChecking ? 'Checking…' : 'Retry connection'}
            </button>
          </div>
        )}
        {showLayoutAlerts && alerts.length > 0 && (
          <section className="tournament-alert-stack" aria-label="Tournament alerts">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`tournament-alert-banner tournament-alert-banner--${alert.severity}`}
                role={alert.severity === 'urgent' ? 'alert' : 'status'}
              >
                <span className="tournament-alert-pill">{alert.severity}</span>
                <div className="tournament-alert-copy">
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
              </div>
            ))}
          </section>
        )}
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <strong>FD Alumni Basketball Hub</strong>
          <p>A central guide to schedule, standings, tickets, streams, tournament info, coverage, sponsors, and tournament history.</p>
          <p className="site-credit">Built by <a href={externalHref('https://shimizu-technology.com') || undefined} target="_blank" rel="noreferrer">Shimizu Technology</a>.</p>
        </div>
        <nav className="footer-links" aria-label="More tournament pages">
          {navItems.filter(({ to }) => !siteMode.navItems.some((item) => item.to === to)).map(({ to, label }) => <NavLink key={to} to={to}>{label}</NavLink>)}
        </nav>
        <div className="footer-links" aria-label="Tournament and partner links">
          <NavLink to="/admin">Organizer sign in</NavLink>
          <a href={externalHref('https://fatherduenas.com/') || undefined} target="_blank" rel="noreferrer">Father Duenas</a>
          <a href={externalHref(import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net') || undefined} target="_blank" rel="noreferrer">GuamTime</a>
          <a href={externalHref(import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com') || undefined} target="_blank" rel="noreferrer">Clutch</a>
          <a href={externalHref('https://guamsportsnetwork.com/') || undefined} target="_blank" rel="noreferrer">GSPN</a>
        </div>
      </footer>

      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        {bottomNavItems.map((item) => {
          const Icon = bottomIcons[item.to as keyof typeof bottomIcons] || IconChart
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              className={({ isActive }) => `mobile-bottom-nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={20} className="mobile-bottom-nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={`mobile-bottom-nav-item${moreActive ? ' active' : ''}`}
          aria-label={open ? 'Close more menu' : 'Open more menu'}
          aria-expanded={open}
          aria-controls={publicMenuId}
          onClick={() => setOpen((value) => !value)}
        >
          <IconMenu size={20} className="mobile-bottom-nav-icon" />
          <span>More</span>
        </button>
      </nav>
    </div>
  )
}
