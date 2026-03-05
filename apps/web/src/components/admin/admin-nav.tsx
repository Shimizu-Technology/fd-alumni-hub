'use client'

import { useRef, useState, useEffect } from 'react'
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
  ChevronLeft,
  ChevronRight,
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  // Check scroll position to show/hide arrow indicators
  const updateScrollIndicators = () => {
    const el = scrollRef.current
    if (!el) return
    const canScrollLeft = el.scrollLeft > 8
    const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 8
    setShowLeftArrow(canScrollLeft)
    setShowRightArrow(canScrollRight)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // Initial check
    updateScrollIndicators()

    // Re-check on scroll
    el.addEventListener('scroll', updateScrollIndicators, { passive: true })
    // Re-check on resize
    window.addEventListener('resize', updateScrollIndicators)

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [])

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = direction === 'left' ? -200 : 200
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Admin navigation"
      className="relative rounded-xl border bg-white shadow-sm"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* Left scroll indicator + button */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 z-10 flex items-center
          pointer-events-none transition-opacity duration-200
          ${showLeftArrow ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      >
        {/* Gradient fade */}
        <div className="h-full w-8 bg-gradient-to-r from-white to-transparent rounded-l-xl" />
        <button
          onClick={() => scrollBy('left')}
          tabIndex={-1}
          className="
            pointer-events-auto -ml-6 flex h-7 w-7 items-center justify-center
            rounded-full bg-white/90 shadow border border-neutral-200
            hover:bg-neutral-50 transition-colors
          "
        >
          <ChevronLeft className="h-4 w-4 text-neutral-600" />
        </button>
      </div>

      {/* Right scroll indicator + button */}
      <div
        className={`
          absolute right-0 top-0 bottom-0 z-10 flex items-center
          pointer-events-none transition-opacity duration-200
          ${showRightArrow ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      >
        <button
          onClick={() => scrollBy('right')}
          tabIndex={-1}
          className="
            pointer-events-auto -mr-6 flex h-7 w-7 items-center justify-center
            rounded-full bg-white/90 shadow border border-neutral-200
            hover:bg-neutral-50 transition-colors
          "
        >
          <ChevronRight className="h-4 w-4 text-neutral-600" />
        </button>
        {/* Gradient fade */}
        <div className="h-full w-8 bg-gradient-to-l from-white to-transparent rounded-r-xl" />
      </div>

      {/* Scrollable links container */}
      <div
        ref={scrollRef}
        className="
          flex gap-1 p-1.5 overflow-x-auto
          scrollbar-hide
          scroll-smooth
          snap-x snap-mandatory
        "
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
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
                transition-all duration-200 ease-out whitespace-nowrap shrink-0
                snap-start
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fd-maroon)] focus-visible:ring-offset-1
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
