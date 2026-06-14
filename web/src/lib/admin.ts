import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Tournament } from './types'

export function useTournamentSelection() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tournamentId = searchParams.get('tournamentId') || ''

  const setTournamentId = useCallback((value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('tournamentId', value)
    else next.delete('tournamentId')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return [tournamentId, setTournamentId] as const
}

export function selectedTournament(tournaments: Tournament[], tournamentId: string) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || tournaments[0] || null
}

export function tournamentScopedPath(path: string, tournamentId?: string | null) {
  if (!tournamentId) return path
  return `${path}?tournamentId=${encodeURIComponent(tournamentId)}`
}
