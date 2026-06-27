import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { IconClose, IconMenu, IconShield } from './Icons'
import { externalHref } from '../lib/urls'

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
          <button className="icon-button mobile-only" type="button" aria-label="Open menu" onClick={() => setOpen(true)}><IconMenu /></button>
        </div>
      </header>

      {open && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div className="mobile-menu-panel">
            <button className="icon-button" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><IconClose /></button>
            {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}>{item.label}</NavLink>)}
            <NavLink to="/admin" onClick={() => setOpen(false)}>Admin</NavLink>
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
        <div className="footer-links">
          <a href={externalHref(import.meta.env.VITE_GUAMTIME_URL || 'https://guamtime.net') || undefined} target="_blank" rel="noreferrer">GuamTime</a>
          <a href={externalHref(import.meta.env.VITE_CLUTCH_URL || 'https://www.clutchguam.com') || undefined} target="_blank" rel="noreferrer">Clutch</a>
        </div>
      </footer>
    </div>
  )
}
