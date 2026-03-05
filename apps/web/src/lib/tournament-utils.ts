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

  // No known-good status found — return null to avoid silently surfacing
  // a cancelled, paused, or unknown-status tournament as the active context.
  return null
}
