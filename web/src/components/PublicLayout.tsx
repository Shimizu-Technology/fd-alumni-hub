import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { IconClose, IconMenu, IconShield } from './Icons'
import { externalHref } from '../lib/urls'

const publicMenuId = 'fd-public-mobile-menu'

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

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
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
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}>{item.label}</NavLink>)}
        </nav>
        <div className="header-actions">
          <NavLink className="admin-link" to="/admin"><IconShield size={16} /> Admin</NavLink>
          <button className="icon-button menu-button mobile-only" type="button" aria-label="Open menu" aria-expanded={open} aria-controls={publicMenuId} onClick={() => setOpen(true)}><IconMenu /><span>Menu</span></button>
        </div>
      </header>

      {open && (
        <div className="mobile-menu" role="presentation">
          <button className="mobile-menu-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div id={publicMenuId} className="mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Main navigation">
            <div className="mobile-menu-head">
              <span className="brand-crest" aria-hidden="true"><img src="/brand/fd-crest.png" alt="" /></span>
              <span><strong>FD Alumni Basketball Hub</strong><small>Central Tournament Hub</small></span>
              <button className="icon-button" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><IconClose /></button>
            </div>
            <nav className="mobile-menu-links" aria-label="Main navigation">
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
