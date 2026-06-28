import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { IconClose, IconMenu, IconShield } from './Icons'
import { externalHref } from '../lib/urls'

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
  { to: '/today', label: 'Today' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/standings', label: 'Standings' },
  { to: '/watch', label: 'Watch' },
  { to: '/info', label: 'Info' },
  { to: '/news', label: 'News' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/history', label: 'History' },
  { to: '/sponsors', label: 'Sponsors' },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuPanelRef = useRef<HTMLDivElement | null>(null)

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
          {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <NavLink className="admin-link" to="/admin"><IconShield size={16} /> Admin</NavLink>
          <button ref={menuButtonRef} className="icon-button menu-button mobile-only" type="button" aria-label="Open menu" aria-expanded={open} aria-controls={publicMenuId} onClick={() => setOpen(true)}><IconMenu /><span>Menu</span></button>
        </div>
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
            <NavLink className="mobile-admin-link" to="/admin" onClick={() => setOpen(false)}><IconShield size={16} /> Admin workspace</NavLink>
          </div>
        </div>
      )}

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div>
          <strong>FD Alumni Basketball Hub</strong>
          <p>A central guide to schedule, standings, tickets, streams, tournament info, coverage, sponsors, and tournament history.</p>
          <p className="site-credit">Built by <a href={externalHref('https://shimizu-technology.com') || undefined} target="_blank" rel="noreferrer">Shimizu Technology</a>.</p>
        </div>
        <div className="footer-links" aria-label="Tournament and partner links">
          <a href={externalHref('https://fatherduenas.com/') || undefined} target="_blank" rel="noreferrer">Father Duenas</a>
          <a href={externalHref(import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net') || undefined} target="_blank" rel="noreferrer">GuamTime</a>
          <a href={externalHref(import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com') || undefined} target="_blank" rel="noreferrer">Clutch</a>
          <a href={externalHref('https://guamsportsnetwork.com/') || undefined} target="_blank" rel="noreferrer">GSPN</a>
        </div>
      </footer>
    </div>
  )
}
