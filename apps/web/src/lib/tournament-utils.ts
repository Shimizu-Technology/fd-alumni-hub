export type TournamentLike = {
  id: string
  status: string
  year: number
}

export function findActiveTournament<T extends TournamentLike>(list: T[]): T | null {
  const live = list.find((t) => t.status === 'live')
  if (live) return live

  const upcoming = list.find((t) => t.status === 'upcoming')
  if (upcoming) return upcoming

  const mostRecentCompleted = list
    .filter((t) => t.status === 'completed')
    .sort((a, b) => b.year - a.year)[0]
  if (mostRecentCompleted) return mostRecentCompleted

  // Final fallback if no completed tournament exists
  const sortedByYear = [...list].sort((a, b) => b.year - a.year)
  return sortedByYear[0] ?? null
}
