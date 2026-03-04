import Link from 'next/link'

const navLinks = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Standings', href: '/standings' },
  { label: 'Watch', href: '/watch' },
  { label: 'News', href: '/news' },
  { label: 'Sponsors', href: '/sponsors' },
]

function ShieldIcon() {
  return (
    <svg width="22" height="24" viewBox="0 0 28 30" fill="none" aria-hidden="true">
      <path
        d="M14 1L2 6.5V15.5C2 22.0 7.2 27.8 14 29C20.8 27.8 26 22.0 26 15.5V6.5L14 1Z"
        fill="#d9b26f"
      />
      <path
        d="M14 4.5L5 9V15.5C5 20.7 9 25.3 14 26.5C19 25.3 23 20.7 23 15.5V9L14 4.5Z"
        fill="#3d0a18"
      />
      <text x="14" y="19" textAnchor="middle" fill="#d9b26f" fontSize="8" fontWeight="800" fontFamily="sans-serif" letterSpacing="-0.3">
        FD
      </text>
    </svg>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer style={{ background: 'var(--fd-maroon-deeper)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">

          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <ShieldIcon />
              <div>
                <span className="block text-sm font-bold" style={{ color: 'var(--fd-gold)' }}>FD Alumni</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(240,232,236,0.4)' }}>
                  Basketball Hub
                </span>
              </div>
            </Link>
            <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'rgba(240,232,236,0.45)' }}>
              The official hub for FD Alumni Basketball. Schedule, standings, watch links, and verified updates.
            </p>
          </div>

          {/* Nav links */}
          <nav aria-label="Footer navigation">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: 'rgba(240,232,236,0.4)' }}>
              Pages
            </p>
            <ul className="flex flex-col gap-2" role="list">
              {navLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm transition-colors duration-150 footer-nav-link"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-8 pt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(240,232,236,0.3)' }}>
            &copy; {year} FD Alumni Basketball Hub. All rights reserved.
          </p>
          <p className="text-xs" style={{ color: 'rgba(240,232,236,0.25)' }}>
            Built for Guam basketball
          </p>
        </div>
      </div>
    </footer>
  )
}
