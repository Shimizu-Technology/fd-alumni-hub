'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftArrow(el.scrollLeft > 8)
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollIndicators()
    el.addEventListener('scroll', updateScrollIndicators, { passive: true })
    window.addEventListener('resize', updateScrollIndicators)

    return () => {
      el.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [updateScrollIndicators])

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' })
  }

  return (
    <nav aria-label="Admin navigation" className="relative rounded-xl border bg-white p-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <div
        className={`pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-white to-transparent transition-opacity ${showLeftArrow ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => scrollBy('left')}
        aria-label="Scroll admin tabs left"
        aria-hidden={!showLeftArrow}
        aria-disabled={!showLeftArrow}
        tabIndex={showLeftArrow ? 0 : -1}
        className={`absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white p-1 shadow transition ${showLeftArrow ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-8"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {LINKS.map(([href, label]) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${active ? 'text-white shadow-sm' : 'border text-neutral-700 hover:bg-neutral-100'}`}
              style={active ? { background: 'var(--fd-maroon)' } : { borderColor: 'var(--border-subtle)' }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div
        className={`pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-white to-transparent transition-opacity ${showRightArrow ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => scrollBy('right')}
        aria-label="Scroll admin tabs right"
        aria-hidden={!showRightArrow}
        aria-disabled={!showRightArrow}
        tabIndex={showRightArrow ? 0 : -1}
        className={`absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border bg-white p-1 shadow transition ${showRightArrow ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}
