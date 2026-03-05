'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Gamepad2,
  Link2,
  AlertCircle,
  Users,
  Trophy,
  Newspaper,
  Image,
  Inbox,
  Heart,
} from 'lucide-react'

const LINKS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/games', label: 'Games', icon: Gamepad2 },
  { href: '/admin/links', label: 'Bulk Links', icon: Link2 },
  { href: '/admin/missing-links', label: 'Missing Links', icon: AlertCircle },
  { href: '/admin/divisions', label: 'Divisions', icon: Users },
  { href: '/admin/standings', label: 'Standings', icon: Trophy },
  { href: '/admin/news', label: 'News', icon: Newspaper },
  { href: '/admin/media', label: 'Media', icon: Image },
  { href: '/admin/ingest', label: 'Ingestion Queue', icon: Inbox },
  { href: '/admin/sponsors', label: 'Sponsors', icon: Heart },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin navigation"
      className="rounded-xl border bg-white p-1.5 shadow-sm"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex flex-wrap gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={`
                group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
                transition-all duration-200 ease-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                ${active
                  ? 'bg-[var(--fd-maroon)] text-white shadow-md'
                  : 'text-[var(--neutral-600)] hover:bg-[var(--neutral-100)] hover:text-[var(--neutral-900)]'
                }
              `}
              style={{
                boxShadow: active ? 'var(--shadow-maroon)' : undefined,
              }}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                  active ? '' : 'group-hover:scale-110'
                }`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span>{label}</span>
              {active && (
                <span
                  className="absolute inset-x-0 -bottom-1.5 mx-auto h-0.5 w-6 rounded-full bg-white/60"
                  aria-hidden="true"
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
