'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const links = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Standings', href: '/standings' },
  { label: 'Watch', href: '/watch' },
  { label: 'News', href: '/news' },
  { label: 'History', href: '/history' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Sponsors', href: '/sponsors' },
] as const

function FDShieldIcon() {
  return (
    <svg width="28" height="30" viewBox="0 0 28 30" fill="none" aria-hidden="true">
      <path
        d="M14 1L2 6.5V15.5C2 22.0 7.2 27.8 14 29C20.8 27.8 26 22.0 26 15.5V6.5L14 1Z"
        fill="#d9b26f"
        stroke="#d9b26f"
        strokeWidth="0.5"
      />
      <path
        d="M14 4.5L5 9V15.5C5 20.7 9 25.3 14 26.5C19 25.3 23 20.7 23 15.5V9L14 4.5Z"
        fill="#5a1025"
      />
      <text x="14" y="19" textAnchor="middle" fill="#d9b26f" fontSize="8" fontWeight="800" fontFamily="sans-serif" letterSpacing="-0.3">
        FD
      </text>
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="14" x2="17" y2="14" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  )
}

export function SiteHeader() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <>
      <header
        className="sticky top-0 z-40 transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(61, 10, 24, 0.96)'
            : 'var(--header-bg)',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)'}`,
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.25)' : 'none',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-0" style={{ height: '56px' }}>

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            aria-label="FD Alumni Hub Home"
          >
            <div className="transition-transform duration-200 group-hover:scale-105">
              <FDShieldIcon />
            </div>
            <div>
              <span
                className="block text-[15px] font-bold leading-tight tracking-tight"
                style={{ color: 'var(--fd-gold)' }}
              >
                FD Alumni
              </span>
              <span
                className="block text-[10px] font-semibold uppercase tracking-[0.14em] leading-tight"
                style={{ color: 'rgba(240,232,236,0.55)' }}
              >
                Basketball Hub
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main navigation">
            {links.map(({ label, href }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-150"
                  style={{
                    color: active ? '#fff' : 'rgba(240,232,236,0.7)',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = '#fff'
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'
                  }}
                  onMouseLeave={e => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(240,232,236,0.7)'
                    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
                      style={{ background: 'var(--fd-gold)' }}
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            className="flex items-center justify-center rounded-lg p-2 md:hidden transition-colors duration-150"
            style={{ color: 'var(--header-text)', background: 'rgba(255,255,255,0.06)' }}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Mobile nav overlay */}
      <div
        className={`nav-overlay md:hidden ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile nav drawer */}
      <nav
        className={`nav-drawer md:hidden ${drawerOpen ? 'open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!drawerOpen}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <FDShieldIcon />
            <span className="text-sm font-semibold" style={{ color: 'var(--fd-gold)' }}>FD Alumni Hub</span>
          </div>
          <button
            className="flex items-center justify-center rounded-lg p-2 transition-colors"
            style={{ color: 'var(--header-text)', background: 'rgba(255,255,255,0.06)' }}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Drawer links */}
        <ul className="flex flex-col gap-1" role="list">
          {links.map(({ label, href }) => {
            const active = pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    color: active ? '#fff' : 'rgba(240,232,236,0.7)',
                    background: active ? 'rgba(217,178,111,0.15)' : 'transparent',
                    borderLeft: active ? '3px solid var(--fd-gold)' : '3px solid transparent',
                  }}
                >
                  {label}
                  {active && (
                    <span className="ml-auto text-xs font-semibold" style={{ color: 'var(--fd-gold)' }}>
                      &#8212;
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Drawer footer */}
        <div className="mt-auto pt-8 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-xs" style={{ color: 'rgba(240,232,236,0.35)' }}>
            FD Alumni Basketball Hub
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(240,232,236,0.25)' }}>
            Official tournament hub for Guam
          </p>
        </div>
      </nav>
    </>
  )
}
