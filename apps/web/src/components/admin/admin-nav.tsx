'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  ['/admin', 'Overview'],
  ['/admin/games', 'Games'],
  ['/admin/links', 'Bulk Links'],
  ['/admin/missing-links', 'Missing Links'],
  ['/admin/divisions', 'Divisions'],
  ['/admin/standings', 'Standings'],
  ['/admin/news', 'News'],
  ['/admin/media', 'Media'],
  ['/admin/ingest', 'Ingestion Queue'],
  ['/admin/sponsors', 'Sponsors'],
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin navigation" className="rounded-xl border bg-white p-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex flex-wrap gap-2">
        {LINKS.map(([href, label]) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className="rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150"
              style={
                active
                  ? {
                      background: 'var(--fd-maroon)',
                      color: '#fff',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
                    }
                  : {
                      background: 'var(--neutral-100)',
                      color: 'var(--neutral-700)',
                      border: '1px solid var(--border-subtle)',
                    }
              }
            >
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
