import { db } from '@/lib/db'

export async function getHomeTournamentContext() {
  const [upcomingOrLive, latestCompletedWithGames] = await Promise.all([
    db.tournament.findFirst({
      where: { status: { in: ['live', 'upcoming'] } },
      orderBy: [{ year: 'desc' }],
    }),
    db.tournament.findFirst({
      where: {
        status: 'completed',
        games: { some: {} },
      },
      orderBy: [{ year: 'desc' }],
    }),
  ])

  return { upcomingOrLive, latestCompletedWithGames }
}

export async function getActiveTournament() {
  const { upcomingOrLive, latestCompletedWithGames } = await getHomeTournamentContext()

  const upcomingOrLiveWithGames = upcomingOrLive
    ? await db.tournament.findFirst({
        where: { id: upcomingOrLive.id, games: { some: {} } },
      })
    : null

  if (upcomingOrLiveWithGames) return upcomingOrLiveWithGames
  if (latestCompletedWithGames) return latestCompletedWithGames
  return upcomingOrLive
}

export async function getTournamentByYear(year: number) {
  return db.tournament.findFirst({ where: { year } })
}
