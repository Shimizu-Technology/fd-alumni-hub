import { db } from '@/lib/db'
import { getActiveTournament, getHomeTournamentContext } from '@/lib/repositories/tournament-repo'
import { resolveGameDivision } from '@/lib/divisions'
import type { Prisma } from '@prisma/client'

type HomeFeed = {
  tournament: Awaited<ReturnType<typeof getActiveTournament>>
  upcomingOrLiveTournament: Awaited<ReturnType<typeof getHomeTournamentContext>>['upcomingOrLive']
  latestResultsTournament: Awaited<ReturnType<typeof getHomeTournamentContext>>['latestCompletedWithGames']
  todayGames: Awaited<ReturnType<typeof db.game.findMany>>
  liveGames: Awaited<ReturnType<typeof db.game.findMany>>
  latestNews: Awaited<ReturnType<typeof db.articleLink.findMany>>
}

export async function getHomeFeed(): Promise<HomeFeed> {
  const [tournament, context] = await Promise.all([
    getActiveTournament(),
    getHomeTournamentContext(),
  ])

  if (!tournament) {
    return {
      tournament: null,
      upcomingOrLiveTournament: context.upcomingOrLive,
      latestResultsTournament: context.latestCompletedWithGames,
      todayGames: [] as HomeFeed['todayGames'],
      liveGames: [] as HomeFeed['liveGames'],
      latestNews: [] as HomeFeed['latestNews'],
    }
  }

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

  return {
    tournament,
    upcomingOrLiveTournament: context.upcomingOrLive,
    latestResultsTournament: context.latestCompletedWithGames,
    todayGames,
    liveGames,
    latestNews,
  }
}

type ScheduleGame = Prisma.GameGetPayload<{
  include: { homeTeam: true; awayTeam: true }
}>

type ScheduleFeed = {
  tournament: Awaited<ReturnType<typeof db.tournament.findUnique>>
  games: ScheduleGame[]
  /** Distinct divisions found across games (resolved from game.division → homeTeam.division) */
  divisions: string[]
  phases: string[]
}

export async function getSchedule(
  tournamentId?: string,
  divisionFilter?: string | null,
  phaseFilter?: 'pool' | 'playoff' | 'fatherson' | null,
): Promise<ScheduleFeed> {
  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await getActiveTournament()
  if (!tournament) return { tournament: null, games: [], divisions: [], phases: [] }

  // Build where clause
  const where: Prisma.GameWhereInput = { tournamentId: tournament.id }
  if (divisionFilter) {
    // Match games where game.division = filter OR (game.division is null AND homeTeam.division = filter)
    where.OR = [
      { division: divisionFilter },
      { division: null, homeTeam: { division: divisionFilter } },
    ]
  }
  if (phaseFilter === 'pool') where.notes = { contains: 'phase=pool' }
  if (phaseFilter === 'playoff') where.notes = { contains: 'phase=playoff' }
  if (phaseFilter === 'fatherson') {
    where.OR = [
      { bracketCode: 'FS' },
      { homeTeam: { displayName: { contains: 'FS', mode: 'insensitive' } } },
      { awayTeam: { displayName: { contains: 'FS', mode: 'insensitive' } } },
    ]
  }

  const games = await db.game.findMany({
    where,
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
    take: 500,
  })

  // Collect distinct divisions from this tournament's games
  const allGames = divisionFilter
    ? await db.game.findMany({
        where: { tournamentId: tournament.id },
        select: { division: true, homeTeam: { select: { division: true } } },
      })
    : games.map(g => ({ division: g.division, homeTeam: { division: g.homeTeam.division } }))

  const divSet = new Set<string>()
  const phaseSet = new Set<string>()
  for (const g of allGames) {
    const resolved = resolveGameDivision(g.division, g.homeTeam?.division)
    if (resolved) divSet.add(resolved)
  }

  const phaseRows = await db.game.findMany({
    where: { tournamentId: tournament.id },
    select: { notes: true, bracketCode: true, homeTeam: { select: { displayName: true } }, awayTeam: { select: { displayName: true } } },
  })
  for (const g of phaseRows) {
    if (g.notes?.includes('phase=pool')) phaseSet.add('pool')
    if (g.notes?.includes('phase=playoff')) phaseSet.add('playoff')
    const isFS = g.bracketCode === 'FS' || /\bFS\b/i.test(g.homeTeam.displayName) || /\bFS\b/i.test(g.awayTeam.displayName)
    if (isFS) phaseSet.add('fatherson')
  }

  return { tournament, games, divisions: Array.from(divSet).sort(), phases: Array.from(phaseSet) }
}

type StandingWithTeam = Prisma.StandingGetPayload<{
  include: { team: true }
}>

type StandingsFeed = {
  tournament: Awaited<ReturnType<typeof db.tournament.findUnique>>
  standings: StandingWithTeam[]
  divisions: string[]
}

export async function getStandings(
  tournamentId?: string,
  divisionFilter?: string | null,
): Promise<StandingsFeed> {
  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await getActiveTournament()
  if (!tournament) return { tournament: null, standings: [], divisions: [] }

  // Get all teams' divisions for the tab list
  const allTeams = await db.team.findMany({
    where: { tournamentId: tournament.id },
    select: { division: true },
  })
  const divSet = new Set<string>()
  for (const t of allTeams) {
    if (t.division) divSet.add(t.division)
  }

  // Apply filter: if divisionFilter set, filter teams by division
  const teamWhere: Prisma.TeamWhereInput = { tournamentId: tournament.id }
  if (divisionFilter) teamWhere.division = divisionFilter

  const standings = await db.standing.findMany({
    where: {
      tournamentId: tournament.id,
      team: teamWhere,
    },
    include: { team: true },
    orderBy: [{ wins: 'desc' }, { losses: 'asc' }, { pointsFor: 'desc' }],
    take: 100,
  })

  return { tournament, standings, divisions: Array.from(divSet).sort() }
}
