'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Calendar, Check } from 'lucide-react'
import { useTournament, type TournamentSummary } from '@/contexts/tournament-context'

function StatusDot({ status }: { status: TournamentSummary['status'] }) {
  const color =
    status === 'live'
      ? 'bg-green-500'
      : status === 'upcoming'
        ? 'bg-yellow-500'
        : 'bg-neutral-400'

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={status} />
}

export function TournamentSelector() {
  const { tournaments, currentTournament, setCurrentTournament, isLoading } = useTournament()
  const [open, setOpen] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) setShowAllCompleted(false)
  }, [open])

  const activeTournaments = tournaments.filter((t) => t.status !== 'completed')
  const completedTournaments = tournaments.filter((t) => t.status === 'completed')
  const displayedCompleted = showAllCompleted ? completedTournaments : completedTournaments.slice(0, 5)

  const handleSelect = (tournament: TournamentSummary) => {
    setCurrentTournament(tournament.id)
    setOpen(false)
    setShowAllCompleted(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isLoading}
        aria-expanded={open}
        aria-haspopup="menu"
        className="
          flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
          transition-colors border
          bg-white hover:bg-neutral-50
          text-neutral-700 border-neutral-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fd-maroon)] focus-visible:ring-offset-1
          disabled:opacity-50 disabled:cursor-wait
        "
      >
        <Calendar className="h-4 w-4 text-[var(--fd-maroon)]" />
        <span className="max-w-[140px] truncate">
          {isLoading
            ? 'Loading...'
            : currentTournament
              ? `${currentTournament.name} ${currentTournament.year}`
              : 'Select Tournament'}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="
            absolute right-0 z-50 mt-1.5 w-72 origin-top-right
            rounded-xl border border-neutral-200 bg-white shadow-lg
            animate-in fade-in-0 zoom-in-95 duration-150
            max-h-[min(80vh,400px)] overflow-y-auto
          "
        >
          {/* Active tournaments */}
          {activeTournaments.length > 0 && (
            <div role="group" aria-label="Active tournaments" className="p-1.5">
              <p aria-hidden="true" className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Active
              </p>
              {activeTournaments.map((t) => (
                <TournamentOption
                  key={t.id}
                  tournament={t}
                  isSelected={currentTournament?.id === t.id}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}

          {/* Completed tournaments */}
          {completedTournaments.length > 0 && (
            <div role="group" aria-label="Completed tournaments" className="border-t border-neutral-100 p-1.5">
              <p aria-hidden="true" className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Completed
              </p>
              {displayedCompleted.map((t) => (
                <TournamentOption
                  key={t.id}
                  tournament={t}
                  isSelected={currentTournament?.id === t.id}
                  onSelect={handleSelect}
                />
              ))}
              {completedTournaments.length > 5 && !showAllCompleted && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setShowAllCompleted(true)}
                  className="w-full px-3 py-1.5 text-left text-xs text-neutral-500 hover:text-neutral-700"
                >
                  +{completedTournaments.length - 5} more in history
                </button>
              )}
            </div>
          )}

          {tournaments.length === 0 && !isLoading && (
            <p className="px-3 py-4 text-sm text-neutral-500 text-center">
              No tournaments found
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TournamentOption({
  tournament,
  isSelected,
  onSelect,
}: {
  tournament: TournamentSummary
  isSelected: boolean
  onSelect: (t: TournamentSummary) => void
}) {
  return (
    <button
      role="menuitem"
      onClick={() => onSelect(tournament)}
      className={`
        w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm
        transition-colors
        ${isSelected
          ? 'bg-[var(--fd-maroon-light,#fdf2f8)] text-[var(--fd-maroon)]'
          : 'text-neutral-700 hover:bg-neutral-100'
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {tournament.name} {tournament.year}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <StatusDot status={tournament.status} />
          <span className="capitalize">{tournament.status}</span>
        </div>
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-[var(--fd-maroon)]" />}
    </button>
  )
}
