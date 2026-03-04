import { db } from '@/lib/db'

export async function getActiveTournament() {
  const withGames = await db.tournament.findFirst({
    where: {
      status: { in: ['live', 'upcoming'] },
      games: { some: {} },
    },
    orderBy: [{ year: 'desc' }],
  })
  if (withGames) return withGames

  const latestCompletedWithGames = await db.tournament.findFirst({
    where: {
      status: 'completed',
      games: { some: {} },
    },
    orderBy: [{ year: 'desc' }],
  })
  if (latestCompletedWithGames) return latestCompletedWithGames

  return db.tournament.findFirst({
    where: { status: { in: ['live', 'upcoming'] } },
    orderBy: [{ year: 'desc' }],
  })
}

export async function getTournamentByYear(year: number) {
  return db.tournament.findFirst({ where: { year } })
}
