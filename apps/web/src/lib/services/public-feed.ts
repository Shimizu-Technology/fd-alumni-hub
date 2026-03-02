import { db } from '@/lib/db'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'

export async function getHomeFeed() {
  const tournament = await getActiveTournament()
  if (!tournament) return { tournament: null, todayGames: [], liveGames: [], latestNews: [] }

  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const [todayGames, liveGames, latestNews] = await Promise.all([
    db.game.findMany({
      where: { tournamentId: tournament.id, startTime: { gte: start, lte: end } },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { startTime: 'asc' },
      take: 20,
    }),
    db.game.findMany({
      where: { tournamentId: tournament.id, status: 'live' },
      include: { homeTeam: true, awayTeam: true },
      orderBy: { startTime: 'asc' },
      take: 10,
    }),
    db.articleLink.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  return { tournament, todayGames, liveGames, latestNews }
}

export async function getSchedule(tournamentId?: string) {
  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await getActiveTournament()
  if (!tournament) return { tournament: null, games: [] }

  const games = await db.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
    take: 500,
  })
  return { tournament, games }
}

export async function getStandings(tournamentId?: string) {
  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await getActiveTournament()
  if (!tournament) return { tournament: null, standings: [] }

  const standings = await db.standing.findMany({
    where: { tournamentId: tournament.id },
    include: { team: true },
    orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { pointsFor: 'desc' }],
    take: 100,
  })
  return { tournament, standings }
}
