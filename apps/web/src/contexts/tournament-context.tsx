'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

export interface TournamentSummary {
  id: string
  name: string
  year: number
  status: 'upcoming' | 'live' | 'completed'
  startDate: string
  endDate: string
}

interface TournamentContextType {
  tournaments: TournamentSummary[]
  currentTournament: TournamentSummary | null
  isLoading: boolean
  error: string | null
  setCurrentTournament: (tournament: TournamentSummary | null) => void
  refreshTournaments: () => Promise<void>
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined)

const STORAGE_KEY = 'fd-admin-tournament-id'

interface TournamentProviderProps {
  children: ReactNode
  initialTournaments?: TournamentSummary[]
  initialCurrentId?: string
}

export function TournamentProvider({
  children,
  initialTournaments = [],
  initialCurrentId,
}: TournamentProviderProps) {
  const [tournaments, setTournaments] = useState<TournamentSummary[]>(initialTournaments)
  const getInitialTournament = (): TournamentSummary | null => {
    if (!initialTournaments.length) return null
    if (initialCurrentId) {
      const found = initialTournaments.find((t) => t.id === initialCurrentId)
      if (found) return found
    }
    return findActiveTournament(initialTournaments)
  }

  const [currentTournament, setCurrentTournamentState] = useState<TournamentSummary | null>(getInitialTournament)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Find the default active tournament
  const findActiveTournament = useCallback((list: TournamentSummary[]): TournamentSummary | null => {
    // Priority: live > upcoming > most recent completed
    const live = list.find((t) => t.status === 'live')
    if (live) return live

    const upcoming = list.find((t) => t.status === 'upcoming')
    if (upcoming) return upcoming

    // Fall back to most recent completed
    const sorted = [...list].sort((a, b) => b.year - a.year)
    return sorted[0] ?? null
  }, [])

  const refreshTournaments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch('/api/admin/tournaments')
      if (!res.ok) throw new Error('Failed to fetch tournaments')
      const data: TournamentSummary[] = await res.json()
      setTournaments(data)

      // Restore from localStorage or find active
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (savedId) {
        const saved = data.find((t) => t.id === savedId)
        if (saved) {
          setCurrentTournamentState(saved)
          return
        }
      }

      // Find active tournament
      setCurrentTournamentState(findActiveTournament(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments')
    } finally {
      setIsLoading(false)
    }
  }, [findActiveTournament])

  const setCurrentTournament = useCallback((tournament: TournamentSummary | null) => {
    setCurrentTournamentState(tournament)
    if (typeof window !== 'undefined') {
      if (tournament) {
        localStorage.setItem(STORAGE_KEY, tournament.id)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    if (initialTournaments.length > 0) {
      // Use provided initial data
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const targetId = savedId ?? initialCurrentId
      if (targetId) {
        const saved = initialTournaments.find((t) => t.id === targetId)
        if (saved) {
          setCurrentTournamentState(saved)
          return
        }
      }
      setCurrentTournamentState(findActiveTournament(initialTournaments))
    } else {
      // Fetch from API
      refreshTournaments()
    }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        currentTournament,
        isLoading,
        error,
        setCurrentTournament,
        refreshTournaments,
      }}
    >
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const context = useContext(TournamentContext)
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider')
  }
  return context
}
