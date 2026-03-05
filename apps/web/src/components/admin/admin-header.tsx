'use client'

import { Shield } from 'lucide-react'
import { TournamentSelector } from './tournament-selector'
import { useTournament } from '@/contexts/tournament-context'
import { StatusDot } from './status-dot'

interface AdminHeaderProps {
  userEmail: string
  userRole: string
}

export function AdminHeader({ userEmail, userRole }: AdminHeaderProps) {
  const { currentTournament, isLoading, error } = useTournament()

  return (
    <div
      className="rounded-xl border bg-white p-4 sm:p-5 shadow-sm"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left side: Icon + title + user info */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--fd-maroon)' }}
          >
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--fd-maroon)]">
              Admin Console
            </h1>
            <p className="text-sm text-[var(--neutral-500)] truncate">
              Authenticated as{' '}
              <span className="font-medium text-[var(--fd-ink)]">{userEmail}</span>
              <span
                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: 'var(--fd-gold-light)',
                  color: 'var(--fd-maroon-dark)',
                }}
              >
                {userRole}
              </span>
            </p>
          </div>
        </div>

        {/* Right side: Tournament selector + active indicator */}
        <div className="flex flex-col items-start sm:items-end gap-2">
          <TournamentSelector />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {!isLoading && currentTournament && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span>Working in:</span>
              <span
                className={`
                  inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold
                  ${currentTournament.status === 'live'
                    ? 'bg-green-100 text-green-800'
                    : currentTournament.status === 'upcoming'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-neutral-100 text-neutral-600'
                  }
                `}
              >
                <StatusDot status={currentTournament.status} size="sm" />
                {currentTournament.name} {currentTournament.year}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

