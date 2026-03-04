import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOURNAMENT_YEAR = 2025
const TOURNAMENT_NAME = 'FD Alumni Basketball Tournament'

type ScoreRow = {
  date: string // YYYY-MM-DD
  winner: string
  loser: string
  winnerScore?: number
  loserScore?: number
  source: string
}

const rows: ScoreRow[] = [
  // GSPN: FD ALUMNI HOOPS OPENS WITH A BANG (Jun 28, 2025)
  { date: '2025-06-27', winner: '2025', loser: '2016/17', winnerScore: 64, loserScore: 51, source: 'gspn-opens-with-a-bang' },
  { date: '2025-06-27', winner: '79/80', loser: '84/85', winnerScore: 46, loserScore: 29, source: 'gspn-opens-with-a-bang' },
  { date: '2025-06-27', winner: '02/04', loser: '2013', winnerScore: 56, loserScore: 48, source: 'gspn-opens-with-a-bang' },

  // GSPN: RESULTS FROM THIS WEEK'S FD ALUMNI HOOPS TOURNEY (Jul 4, 2025)
  { date: '2025-06-30', winner: '2020', loser: '2021', winnerScore: 62, loserScore: 57, source: 'gspn-results-week' },
  { date: '2025-06-30', winner: '2024', loser: '12 Pack', winnerScore: 54, loserScore: 47, source: 'gspn-results-week' },
  { date: '2025-06-30', winner: '99/01/03', loser: '98', winnerScore: 54, loserScore: 41, source: 'gspn-results-week' },

  { date: '2025-07-01', winner: '96/97', loser: '84/85', winnerScore: 66, loserScore: 37, source: 'gspn-results-week' },
  { date: '2025-07-01', winner: '2006', loser: '2007', winnerScore: 65, loserScore: 44, source: 'gspn-results-week' },
  { date: '2025-07-01', winner: '2025', loser: '2023', source: 'gspn-results-week' }, // score missing in article

  { date: '2025-07-02', winner: '79/80', loser: '1988', winnerScore: 35, loserScore: 26, source: 'gspn-results-week' },
  { date: '2025-07-02', winner: '1991', loser: '1989', winnerScore: 43, loserScore: 33, source: 'gspn-results-week' },
  { date: '2025-07-02', winner: '2013', loser: '2025', winnerScore: 70, loserScore: 63, source: 'gspn-results-week' },

  { date: '2025-07-03', winner: '82/86/AD7/92', loser: '75', winnerScore: 32, loserScore: 20, source: 'gspn-results-week' },
  { date: '2025-07-03', winner: '98', loser: '430-5', winnerScore: 65, loserScore: 49, source: 'gspn-results-week' },
  { date: '2025-07-03', winner: '18/19', loser: '2014', winnerScore: 76, loserScore: 50, source: 'gspn-results-week' },
]

const aliases: Record<string, string[]> = {
  '2016/17': ['2016/17', '2016/2017'],
  '98': ['98', '1998'],
  '75': ['75', '1975'],
  '96/97': ['96/97', '96/97/2000'],
  '18/19': ['18/19', '2018/19'],
}

function norm(label: string): string[] {
  const base = label.trim()
  return aliases[base] ?? [base]
}

async function findTeamIds(tournamentId: string, label: string): Promise<string[]> {
  const candidates = norm(label)
  const teams = await prisma.team.findMany({
    where: {
      tournamentId,
      OR: candidates.flatMap(v => [
        { classYearLabel: v },
        { displayName: `Class ${v}` },
      ]),
    },
    select: { id: true },
  })
  if (!teams.length) throw new Error(`Team not found: ${label}`)
  return teams.map(t => t.id)
}

async function main() {
  const t = await prisma.tournament.findFirst({ where: { year: TOURNAMENT_YEAR, name: TOURNAMENT_NAME } })
  if (!t) throw new Error('Tournament not found')

  let updated = 0
  const misses: string[] = []

  for (const r of rows) {
    try {
      const winnerTeamIds = await findTeamIds(t.id, r.winner)
      const loserTeamIds = await findTeamIds(t.id, r.loser)

      const start = new Date(`${r.date}T00:00:00+10:00`)
      const end = new Date(`${r.date}T23:59:59+10:00`)

      let game = await prisma.game.findFirst({
        where: {
          tournamentId: t.id,
          startTime: { gte: start, lte: end },
          OR: [
            { homeTeamId: { in: winnerTeamIds }, awayTeamId: { in: loserTeamIds } },
            { homeTeamId: { in: loserTeamIds }, awayTeamId: { in: winnerTeamIds } },
          ],
        },
      })

      // Fallback when article date is off: pick unique matchup in tournament
      if (!game) {
        const candidates = await prisma.game.findMany({
          where: {
            tournamentId: t.id,
            OR: [
              { homeTeamId: { in: winnerTeamIds }, awayTeamId: { in: loserTeamIds } },
              { homeTeamId: { in: loserTeamIds }, awayTeamId: { in: winnerTeamIds } },
            ],
          },
          orderBy: { startTime: 'asc' },
        })
        if (candidates.length === 1) game = candidates[0]
      }

      if (!game) {
        misses.push(`${r.date}: ${r.winner} vs ${r.loser} (no game found)`)
        continue
      }

      let homeScore: number | null = game.homeScore
      let awayScore: number | null = game.awayScore

      if (r.winnerScore != null && r.loserScore != null) {
        const winnerIsHome = winnerTeamIds.includes(game.homeTeamId)
        homeScore = winnerIsHome ? r.winnerScore : r.loserScore
        awayScore = winnerIsHome ? r.loserScore : r.winnerScore
      }

      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'final',
          homeScore,
          awayScore,
          notes: `${game.notes ?? ''} | source=${r.source} | confidence=confirmed`.trim(),
        },
      })
      updated++
    } catch (e) {
      misses.push(`${r.date}: ${r.winner} vs ${r.loser} (${e instanceof Error ? e.message : 'error'})`)
    }
  }

  // recompute standings from final games with scores only
  await prisma.standing.deleteMany({ where: { tournamentId: t.id } })
  const finals = await prisma.game.findMany({
    where: {
      tournamentId: t.id,
      status: 'final',
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: { homeTeam: true, awayTeam: true },
  })

  const map = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number }>()
  const get = (teamId: string) => {
    if (!map.has(teamId)) map.set(teamId, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 })
    return map.get(teamId)!
  }

  for (const g of finals) {
    const h = get(g.homeTeamId)
    const a = get(g.awayTeamId)
    h.pointsFor += g.homeScore!
    h.pointsAgainst += g.awayScore!
    a.pointsFor += g.awayScore!
    a.pointsAgainst += g.homeScore!
    if (g.homeScore! > g.awayScore!) {
      h.wins += 1
      a.losses += 1
    } else if (g.awayScore! > g.homeScore!) {
      a.wins += 1
      h.losses += 1
    }
  }

  for (const [teamId, s] of map.entries()) {
    await prisma.standing.create({ data: { tournamentId: t.id, teamId, ...s } })
  }

  const totalGames = await prisma.game.count({ where: { tournamentId: t.id } })
  const scoredGames = await prisma.game.count({ where: { tournamentId: t.id, homeScore: { not: null }, awayScore: { not: null } } })

  console.log({
    updated,
    misses,
    coverage: `${scoredGames}/${totalGames}`,
    standingsTeams: map.size,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
