'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type TournamentSummary = {
  id: string
  name: string
  year: number
  status: 'upcoming' | 'live' | 'completed' | (string & {})
}

type TournamentResponse =
  | TournamentSummary[]
  | {
      tournaments: TournamentSummary[]
      currentTournamentId?: string | null
    }

type TournamentContextValue = {
  tournaments: TournamentSummary[]
  currentTournament: TournamentSummary | null
  setCurrentTournament: (id: string) => void
  refreshTournaments: () => Promise<void>
  isLoading: boolean
  error: string | null
}

const TournamentContext = createContext<TournamentContextValue | undefined>(undefined)

const STORAGE_KEY = 'fd-admin-current-tournament-id'

function findActiveTournament(list: TournamentSummary[]): TournamentSummary | null {
  const live = list.find((t) => t.status === 'live')
  if (live) return live

  const upcoming = list.find((t) => t.status === 'upcoming')
  if (upcoming) return upcoming

  const sortedByYear = [...list].sort((a, b) => b.year - a.year)
  return sortedByYear[0] ?? null
}

function normalizeResponse(data: TournamentResponse): {
  tournaments: TournamentSummary[]
  currentTournamentId?: string | null
} {
  if (Array.isArray(data)) return { tournaments: data, currentTournamentId: null }
  return {
    tournaments: data.tournaments ?? [],
    currentTournamentId: data.currentTournamentId ?? null,
  }
}

export function TournamentProvider({
  children,
  initialTournaments,
  initialCurrentId,
}: {
  children: React.ReactNode
  initialTournaments: TournamentSummary[]
  initialCurrentId: string | null
}) {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>(initialTournaments)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [currentTournament, setCurrentTournamentState] = useState<TournamentSummary | null>(() => {
    if (!initialTournaments.length) return null

    // SSR hint always wins on first render
    if (initialCurrentId) {
      const found = initialTournaments.find((t) => t.id === initialCurrentId)
      if (found) return found
    }

    // Client saved preference (only if still valid)
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem(STORAGE_KEY)
      if (savedId) {
        const found = initialTournaments.find((t) => t.id === savedId)
        if (found) return found
      }
    }

    return findActiveTournament(initialTournaments)
  })

  const setCurrentTournament = useCallback(
    (id: string) => {
      const next = tournaments.find((t) => t.id === id) ?? null
      if (!next) return
      setCurrentTournamentState(next)
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next.id)
    },
    [tournaments],
  )

  const refreshTournaments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/tournaments', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load tournaments')
      const payload = normalizeResponse((await response.json()) as TournamentResponse)
      const list = payload.tournaments
      setTournaments(list)

      if (!list.length) {
        setCurrentTournamentState(null)
        if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
        return
      }

      const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const candidates = [savedId, currentTournament?.id, payload.currentTournamentId].filter(Boolean) as string[]

      let next: TournamentSummary | null = null
      for (const id of candidates) {
        const found = list.find((t) => t.id === id)
        if (found) {
          next = found
          break
        }
      }

      if (!next) next = findActiveTournament(list)
      setCurrentTournamentState(next)
      if (next && typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh tournaments')
    } finally {
      setIsLoading(false)
    }
  }, [currentTournament?.id])

  // Reconcile stale localStorage selection once after mount.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedId = localStorage.getItem(STORAGE_KEY)
    if (!savedId) {
      if (currentTournament) localStorage.setItem(STORAGE_KEY, currentTournament.id)
      return
    }

    const valid = tournaments.find((t) => t.id === savedId)
    if (!valid) {
      const fallback = findActiveTournament(tournaments)
      setCurrentTournamentState(fallback)
      if (fallback) localStorage.setItem(STORAGE_KEY, fallback.id)
      else localStorage.removeItem(STORAGE_KEY)
      return
    }

    // Preserve server-selected tournament (initialCurrentId smart default)
    // and only fall back to localStorage when nothing is currently selected.
    if (!currentTournament) {
      setCurrentTournamentState(valid)
    }
  }, [currentTournament, tournaments])

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournaments,
      currentTournament,
      setCurrentTournament,
      refreshTournaments,
      isLoading,
      error,
    }),
    [tournaments, currentTournament, setCurrentTournament, refreshTournaments, isLoading, error],
  )

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>
}

export function useTournamentContext() {
  const context = useContext(TournamentContext)
  if (!context) throw new Error('useTournamentContext must be used within TournamentProvider')
  return context
}

// Backward-compatible alias used across admin components.
export function useTournament() {
  return useTournamentContext()
}
