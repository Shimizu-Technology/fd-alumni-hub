'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  ['Schedule', '/schedule'],
  ['Standings', '/standings'],
  ['Watch', '/watch'],
  ['News', '/news'],
  ['Sponsors', '/sponsors'],
] as const

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[color:var(--bg-page)]/90 backdrop-blur-xl" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[color:var(--fd-maroon)] transition-opacity hover:opacity-80">
          FD Alumni Hub
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border bg-white/80 p-1 text-sm md:flex" style={{ borderColor: 'var(--border-subtle)' }}>
          {links.map(([label, href]) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  active
                    ? 'bg-[color:var(--fd-maroon)] text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
