import { db, withDatabaseFallback } from '@/lib/db'

export async function getHomeTournamentContext() {
  return withDatabaseFallback(async () => {
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
  }, { upcomingOrLive: null, latestCompletedWithGames: null })
}

export async function getActiveTournament() {
  const { upcomingOrLive, latestCompletedWithGames } = await getHomeTournamentContext()

  const upcomingOrLiveWithGames = upcomingOrLive
    ? await withDatabaseFallback(
        () => db.tournament.findFirst({
          where: { id: upcomingOrLive.id, games: { some: {} } },
        }),
        null,
      )
    : null

  if (upcomingOrLiveWithGames) return upcomingOrLiveWithGames
  if (latestCompletedWithGames) return latestCompletedWithGames
  return upcomingOrLive
}

export async function getTournamentByYear(year: number) {
  return withDatabaseFallback(() => db.tournament.findFirst({ where: { year } }), null)
}
