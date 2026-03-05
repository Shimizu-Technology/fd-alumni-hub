'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { findActiveTournament } from '@/lib/tournament-utils'

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

    return findActiveTournament(initialTournaments)
  })

  const tournamentsRef = useRef<TournamentSummary[]>(tournaments)
  useEffect(() => {
    tournamentsRef.current = tournaments
  }, [tournaments])

  const setCurrentTournament = useCallback((id: string) => {
    const next = tournamentsRef.current.find((t) => t.id === id) ?? null
    if (!next) return
    setCurrentTournamentState(next)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, next.id)
  }, [])

  const currentIdRef = useRef<string | undefined>(currentTournament?.id)
  useEffect(() => {
    currentIdRef.current = currentTournament?.id
  }, [currentTournament?.id])

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
      const candidates = [savedId, currentIdRef.current, payload.currentTournamentId].filter(Boolean) as string[]

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
  }, [])

  // Reconcile stale localStorage selection once after mount.
  const reconciledRef = useRef(false)
  useEffect(() => {
    if (reconciledRef.current || typeof window === 'undefined') return
    reconciledRef.current = true

    const savedId = localStorage.getItem(STORAGE_KEY)
    if (!savedId) {
      if (currentTournament) localStorage.setItem(STORAGE_KEY, currentTournament.id)
      return
    }

    const valid = tournamentsRef.current.find((t) => t.id === savedId)
    if (!valid) {
      const fallback = findActiveTournament(tournamentsRef.current)
      setCurrentTournamentState(fallback)
      if (fallback) localStorage.setItem(STORAGE_KEY, fallback.id)
      else localStorage.removeItem(STORAGE_KEY)
      return
    }

    // Preserve server-selected tournament (initialCurrentId smart default)
    // and only fall back to localStorage when nothing is currently selected.
    if (!currentTournament) {
      setCurrentTournamentState(valid)
    } else if (currentTournament.id !== savedId) {
      // Prevent stale localStorage IDs from winning on future refreshes.
      localStorage.setItem(STORAGE_KEY, currentTournament.id)
    }
  }, [])

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
