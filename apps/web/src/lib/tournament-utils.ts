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

  const sortedByYear = [...list].sort((a, b) => b.year - a.year)
  return sortedByYear[0] ?? null
}
