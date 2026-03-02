import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type HistoricalSeed = {
  tournaments: Array<{
    year: number
    name: string
    status: 'upcoming' | 'live' | 'completed'
    startDate: string
    endDate: string
    notes?: string
  }>
  games2025Sample?: Array<{
    date: string
    home: string
    away: string
    homeScore: number | null
    awayScore: number | null
    status: 'scheduled' | 'live' | 'final'
    confidence: 'confirmed' | 'partial' | 'inferred'
  }>
}

async function upsertTeam(tournamentId: string, label: string) {
  return prisma.team.upsert({
    where: { tournamentId_displayName: { tournamentId, displayName: `Class ${label}` } },
    update: {},
    create: {
      tournamentId,
      classYearLabel: label,
      displayName: `Class ${label}`,
      division: 'Open',
    },
  })
}

async function seedFromHistorical() {
  const historicalPath = path.resolve(process.cwd(), '..', '..', 'data', 'historical', 'fd-alumni-tournaments.seed.json')
  if (!fs.existsSync(historicalPath)) {
    console.log('No historical seed file found, skipping historical seed.')
    return
  }

  const parsed = JSON.parse(fs.readFileSync(historicalPath, 'utf8')) as HistoricalSeed

  for (const t of parsed.tournaments) {
    await prisma.tournament.upsert({
      where: { year_name: { year: t.year, name: t.name } },
      update: {
        status: t.status,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
      },
      create: {
        name: t.name,
        year: t.year,
        status: t.status,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
      },
    })
  }

  const t2025 = await prisma.tournament.findFirst({ where: { year: 2025, name: 'FD Alumni Basketball Tournament' } })
  if (t2025 && parsed.games2025Sample?.length) {
    for (const g of parsed.games2025Sample) {
      const home = await upsertTeam(t2025.id, g.home)
      const away = await upsertTeam(t2025.id, g.away)
      const start = new Date(`${g.date}T18:00:00.000Z`)

      await prisma.game.upsert({
        where: {
          tournamentId_homeTeamId_awayTeamId_startTime: {
            tournamentId: t2025.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            startTime: start,
          },
        },
        update: {
          status: g.status,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          notes: `SOURCE: GSPN weekly results (${g.confidence})`,
        },
        create: {
          tournamentId: t2025.id,
          homeTeamId: home.id,
          awayTeamId: away.id,
          startTime: start,
          status: g.status,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          notes: `SOURCE: GSPN weekly results (${g.confidence})`,
        },
      })
    }
  }

  console.log('Historical FD data seeded.')
}

async function main() {
  await seedFromHistorical()

  const year = new Date().getFullYear()
  await prisma.tournament.upsert({
    where: { year_name: { year, name: 'FD Alumni Basketball Tournament' } },
    update: {},
    create: {
      name: 'FD Alumni Basketball Tournament',
      year,
      status: 'upcoming',
      startDate: new Date(`${year}-06-28T00:00:00.000Z`),
      endDate: new Date(`${year}-07-19T23:59:59.000Z`),
    },
  })

  console.log('Current-year seed check complete.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
