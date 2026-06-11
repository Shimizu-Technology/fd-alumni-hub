import { NavLink, Outlet } from 'react-router-dom'
import { SignInButton, SignOutButton } from '@clerk/clerk-react'
import { useAuthContext } from '../contexts/AuthContext'
import { IconCalendar, IconImage, IconLink, IconShield, IconTrophy } from './Icons'
import { LoadingState } from './ui'

const adminItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/games', label: 'Games' },
  { to: '/admin/standings', label: 'Standings' },
  { to: '/admin/divisions', label: 'Divisions' },
  { to: '/admin/links', label: 'Links' },
  { to: '/admin/missing-links', label: 'Missing Links' },
  { to: '/admin/news', label: 'News' },
  { to: '/admin/media', label: 'Media' },
  { to: '/admin/sponsors', label: 'Sponsors' },
  { to: '/admin/ingest', label: 'Ingest' },
]

export function AdminLayout() {
  const auth = useAuthContext()

  if (auth.isLoading) return <div className="admin-shell"><LoadingState label="Verifying admin access" /></div>

  if (auth.isClerkEnabled && !auth.isSignedIn) {
    return (
      <div className="admin-shell centered-shell">
        <div className="auth-card">
          <IconShield size={32} />
          <h1>Admin access</h1>
          <p>Sign in with an allowlisted organizer account to manage tournament data.</p>
          <SignInButton mode="modal" forceRedirectUrl="/admin">
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
            <p className="muted">Set VITE_DEV_AUTH_EMAIL to a Rails development user for local admin access.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink to="/" className="admin-brand"><span className="brand-mark">FD</span><span>Hub Admin</span></NavLink>
        <nav aria-label="Admin navigation">
          {adminItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>)}
        </nav>
        <div className="admin-sidebar-footer">
          <span>{auth.user.email}</span>
          {auth.isClerkEnabled && <SignOutButton><button>Sign out</button></SignOutButton>}
        </div>
      </aside>
      <section className="admin-content">
        <div className="admin-topbar">
          <div className="admin-topbar-icons" aria-hidden="true"><IconCalendar /><IconTrophy /><IconLink /><IconImage /></div>
          <span>{auth.user.fullName}</span>
        </div>
        <Outlet />
      </section>
    </div>
  )
}
