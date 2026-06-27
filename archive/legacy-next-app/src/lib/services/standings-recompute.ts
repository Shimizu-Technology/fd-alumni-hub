import { db } from '@/lib/db'

export async function recomputeStandingsForTournament(tournamentId: string) {
  const teams = await db.team.findMany({ where: { tournamentId } })
  const finalGames = await db.game.findMany({
    where: { tournamentId, status: 'final', homeScore: { not: null }, awayScore: { not: null } },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  })

  const map = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>()
  for (const team of teams) {
    map.set(team.id, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 })
  }

  for (const g of finalGames) {
    const home = map.get(g.homeTeamId)
    const away = map.get(g.awayTeamId)
    if (!home || !away || g.homeScore == null || g.awayScore == null) continue

    home.pointsFor += g.homeScore
    home.pointsAgainst += g.awayScore
    away.pointsFor += g.awayScore
    away.pointsAgainst += g.homeScore

    if (g.homeScore > g.awayScore) {
      home.wins += 1
      away.losses += 1
    } else if (g.awayScore > g.homeScore) {
      away.wins += 1
      home.losses += 1
    }
  }

  await db.$transaction([
    db.standing.deleteMany({ where: { tournamentId } }),
    ...Array.from(map.entries()).map(([teamId, s]) =>
      db.standing.create({
        data: {
          tournamentId,
          teamId,
          wins: s.wins,
          losses: s.losses,
          pointsFor: s.pointsFor,
          pointsAgainst: s.pointsAgainst,
        },
      })
    ),
  ])

  return { teams: teams.length, games: finalGames.length }
}
