/**
 * Score Wiring Pass
 * 
 * Takes newly discovered confirmed score facts and maps into game records
 * ONLY when matchup/date confidence is high.
 * 
 * Safety:
 * - No speculative score imports
 * - Ambiguous matchups left as pending/manual
 * - All writes logged with confidence level
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOURNAMENT_YEAR = 2025
const TOURNAMENT_NAME = 'FD Alumni Basketball Tournament'

interface ConfirmedScore {
  date: string
  home: string
  away: string
  homeScore: number
  awayScore: number
  source: string
  confidence: 'high' | 'medium' | 'low'
}

// High-confidence scores from verified public sources (GSPN, GuamPDN)
// Only including scores with EXACT matchup + date confirmation
const confirmedScores: ConfirmedScore[] = [
  // Already imported - keeping for reference/validation
  { date: '2025-06-27', home: '2025', away: '2016/17', homeScore: 64, awayScore: 51, source: 'gspn-opens-bang', confidence: 'high' },
  { date: '2025-06-27', home: '79/80', away: '84/85', homeScore: 46, awayScore: 29, source: 'gspn-opens-bang', confidence: 'high' },
  { date: '2025-06-27', home: '02/04', away: '2013', homeScore: 56, awayScore: 48, source: 'gspn-opens-bang', confidence: 'high' },
  { date: '2025-06-30', home: '2020', away: '2021', homeScore: 62, awayScore: 57, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-06-30', home: '2024', away: '12 Pack', homeScore: 54, awayScore: 47, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-06-30', home: '99/01/03', away: '98', homeScore: 54, awayScore: 41, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-01', home: '96/97', away: '84/85', homeScore: 66, awayScore: 37, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-01', home: '2006', away: '2007', homeScore: 65, awayScore: 44, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-02', home: '79/80', away: '1988', homeScore: 35, awayScore: 26, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-02', home: '1991', away: '1989', homeScore: 43, awayScore: 33, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-02', home: '2013', away: '2025', homeScore: 70, awayScore: 63, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-03', home: '82/86/AD7/92', away: '75', homeScore: 32, awayScore: 20, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-03', home: '98', away: '430-5', homeScore: 65, awayScore: 49, source: 'gspn-results-week', confidence: 'high' },
  { date: '2025-07-03', home: '18/19', away: '2014', homeScore: 76, awayScore: 50, source: 'gspn-results-week', confidence: 'high' },
]

// Team name normalization aliases
const aliases: Record<string, string[]> = {
  '2016/17': ['2016/17', '2016/2017', 'Class 2016/17'],
  '98': ['98', '1998', 'Class 98', 'Class 1998'],
  '75': ['75', '1975', 'Class 75', 'Class 1975'],
  '96/97': ['96/97', '96/97/2000', 'Class 96/97'],
  '18/19': ['18/19', '2018/19', 'Class 18/19', 'Class 2018/19'],
  '02/04': ['02/04', '2002/04', 'Class 02/04', 'Class 2002/04'],
  '82/86/AD7/92': ['82/86/AD7/92', 'Class 82/86/AD7/92'],
  '99/01/03': ['99/01/03', 'Class 99/01/03'],
  '79/80': ['79/80', 'Class 79/80'],
  '84/85': ['84/85', 'Class 84/85'],
  '430-5': ['430-5', 'Class 430-5'],
  '12 Pack': ['12 Pack', 'Class 12 Pack'],
}

function getAliases(label: string): string[] {
  const base = label.trim()
  const directAliases = aliases[base] ?? [base, `Class ${base}`]
  return directAliases
}

async function findTeamIds(tournamentId: string, label: string): Promise<string[]> {
  const candidates = getAliases(label)
  const teams = await prisma.team.findMany({
    where: {
      tournamentId,
      OR: candidates.flatMap(v => [
        { classYearLabel: v },
        { displayName: v },
      ]),
    },
    select: { id: true, displayName: true, classYearLabel: true },
  })
  return teams.map(t => t.id)
}

interface ScoreResult {
  imported: number
  skipped: number
  alreadyScored: number
  notFound: string[]
  ambiguous: string[]
  updated: string[]
}

async function main(): Promise<ScoreResult> {
  const result: ScoreResult = {
    imported: 0,
    skipped: 0,
    alreadyScored: 0,
    notFound: [],
    ambiguous: [],
    updated: [],
  }

  const tournament = await prisma.tournament.findFirst({
    where: { year: TOURNAMENT_YEAR, name: TOURNAMENT_NAME },
  })

  if (!tournament) {
    console.error('Tournament not found')
    return result
  }

  console.log(`\n🏀 Score Wiring Pass for ${tournament.year} ${tournament.name}`)
  console.log('━'.repeat(60))

  // Get all games upfront to detect duplicates
  const allGames = await prisma.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
  })

  // Build matchup frequency map to detect ambiguous matchups
  const matchupCounts = new Map<string, number>()
  for (const g of allGames) {
    const teams = [g.homeTeam.classYearLabel, g.awayTeam.classYearLabel].sort()
    const key = teams.join(' vs ')
    matchupCounts.set(key, (matchupCounts.get(key) ?? 0) + 1)
  }

  for (const score of confirmedScores) {
    // Only process high confidence scores
    if (score.confidence !== 'high') {
      result.skipped++
      console.log(`⏭️  SKIP (low confidence): ${score.home} vs ${score.away}`)
      continue
    }

    try {
      const homeTeamIds = await findTeamIds(tournament.id, score.home)
      const awayTeamIds = await findTeamIds(tournament.id, score.away)

      if (homeTeamIds.length === 0 || awayTeamIds.length === 0) {
        result.notFound.push(`${score.date}: ${score.home} vs ${score.away}`)
        continue
      }

      // Date-bounded search (exact day match for high confidence)
      const start = new Date(`${score.date}T00:00:00+10:00`)
      const end = new Date(`${score.date}T23:59:59+10:00`)

      const matchingGames = await prisma.game.findMany({
        where: {
          tournamentId: tournament.id,
          startTime: { gte: start, lte: end },
          OR: [
            { homeTeamId: { in: homeTeamIds }, awayTeamId: { in: awayTeamIds } },
            { homeTeamId: { in: awayTeamIds }, awayTeamId: { in: homeTeamIds } },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
      })

      if (matchingGames.length === 0) {
        result.notFound.push(`${score.date}: ${score.home} vs ${score.away}`)
        continue
      }

      if (matchingGames.length > 1) {
        // Ambiguous - multiple games on same day between these teams
        result.ambiguous.push(`${score.date}: ${score.home} vs ${score.away} (${matchingGames.length} matches)`)
        continue
      }

      const game = matchingGames[0]

      // Already has scores?
      if (game.homeScore !== null && game.awayScore !== null) {
        result.alreadyScored++
        continue
      }

      // Determine home/away orientation based on actual game data
      const scoreIsInverted = homeTeamIds.includes(game.awayTeamId)
      const finalHomeScore = scoreIsInverted ? score.awayScore : score.homeScore
      const finalAwayScore = scoreIsInverted ? score.homeScore : score.awayScore

      await prisma.game.update({
        where: { id: game.id },
        data: {
          status: 'final',
          homeScore: finalHomeScore,
          awayScore: finalAwayScore,
          notes: game.notes
            ? `${game.notes} | wired:${score.source}`
            : `wired:${score.source}`,
        },
      })

      result.imported++
      result.updated.push(`${score.date}: ${game.homeTeam.displayName} ${finalHomeScore}-${finalAwayScore} ${game.awayTeam.displayName}`)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      result.notFound.push(`${score.date}: ${score.home} vs ${score.away} (${msg})`)
    }
  }

  // Recompute standings from all final games with scores
  console.log('\n📊 Recomputing standings...')
  await recomputeStandings(tournament.id)

  return result
}

async function recomputeStandings(tournamentId: string): Promise<void> {
  // Clear existing standings
  await prisma.standing.deleteMany({ where: { tournamentId } })

  // Get all final games with scores
  const finals = await prisma.game.findMany({
    where: {
      tournamentId,
      status: 'final',
      homeScore: { not: null },
      awayScore: { not: null },
    },
  })

  const standings = new Map<string, {
    wins: number
    losses: number
    pointsFor: number
    pointsAgainst: number
  }>()

  const getStat = (teamId: string) => {
    if (!standings.has(teamId)) {
      standings.set(teamId, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 })
    }
    return standings.get(teamId)!
  }

  for (const game of finals) {
    const home = getStat(game.homeTeamId)
    const away = getStat(game.awayTeamId)

    home.pointsFor += game.homeScore!
    home.pointsAgainst += game.awayScore!
    away.pointsFor += game.awayScore!
    away.pointsAgainst += game.homeScore!

    if (game.homeScore! > game.awayScore!) {
      home.wins++
      away.losses++
    } else if (game.awayScore! > game.homeScore!) {
      away.wins++
      home.losses++
    }
  }

  // Insert new standings
  for (const [teamId, stats] of standings) {
    await prisma.standing.create({
      data: { tournamentId, teamId, ...stats },
    })
  }

  console.log(`   Updated standings for ${standings.size} teams`)
}

async function printSummary(result: ScoreResult): Promise<void> {
  const tournament = await prisma.tournament.findFirst({
    where: { year: TOURNAMENT_YEAR, name: TOURNAMENT_NAME },
  })
  if (!tournament) return

  const totalGames = await prisma.game.count({ where: { tournamentId: tournament.id } })
  const scoredGames = await prisma.game.count({
    where: {
      tournamentId: tournament.id,
      homeScore: { not: null },
      awayScore: { not: null },
    },
  })

  console.log('\n' + '━'.repeat(60))
  console.log('📋 SCORE WIRING SUMMARY')
  console.log('━'.repeat(60))
  console.log(`   ✅ Imported: ${result.imported}`)
  console.log(`   ⏭️  Skipped (low confidence): ${result.skipped}`)
  console.log(`   ✓  Already scored: ${result.alreadyScored}`)
  console.log(`   ❌ Not found: ${result.notFound.length}`)
  console.log(`   ⚠️  Ambiguous: ${result.ambiguous.length}`)
  console.log(`\n   📊 Coverage: ${scoredGames}/${totalGames} games (${((scoredGames/totalGames)*100).toFixed(1)}%)`)

  if (result.updated.length > 0) {
    console.log('\n   UPDATED GAMES:')
    result.updated.forEach(u => console.log(`   - ${u}`))
  }

  if (result.notFound.length > 0) {
    console.log('\n   NOT FOUND (needs manual review):')
    result.notFound.forEach(n => console.log(`   - ${n}`))
  }

  if (result.ambiguous.length > 0) {
    console.log('\n   AMBIGUOUS (multiple matches - manual resolution required):')
    result.ambiguous.forEach(a => console.log(`   - ${a}`))
  }
}

main()
  .then(printSummary)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
