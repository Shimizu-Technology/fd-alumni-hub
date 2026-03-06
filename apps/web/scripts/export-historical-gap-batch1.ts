import fs from 'node:fs'
import path from 'node:path'
import { db } from '../src/lib/db'

const EXPORTS_DIR = path.resolve(process.cwd(), 'docs', 'exports')

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

type Row = {
  year: number
  gameId: string
  date: string
  matchup: string
  division: string
  bracket: string
  status: string
  missing: string
}

async function main() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true })

  const games = await db.game.findMany({
    where: {
      tournament: { year: { lte: 2025 } },
      status: 'final',
    },
    include: {
      tournament: { select: { year: true, name: true } },
      homeTeam: { select: { displayName: true } },
      awayTeam: { select: { displayName: true } },
    },
    orderBy: [{ startTime: 'asc' }],
  })

  const finalGames = games

  const scoreMissing = finalGames.filter((g) => g.homeScore == null || g.awayScore == null)
  const linkMissing = finalGames.filter((g) => !g.ticketUrl || !g.streamUrl)

  const rows: Row[] = [
    ...scoreMissing.map((g) => ({
      year: g.tournament.year,
      gameId: g.id,
      date: g.startTime.toISOString().slice(0, 10),
      matchup: `${g.homeTeam.displayName} vs ${g.awayTeam.displayName}`,
      division: g.division ?? '',
      bracket: g.bracketCode ?? '',
      status: g.status,
      missing: 'score',
    })),
    ...linkMissing.flatMap((g) => {
      const common = {
        year: g.tournament.year,
        gameId: g.id,
        date: g.startTime.toISOString().slice(0, 10),
        matchup: `${g.homeTeam.displayName} vs ${g.awayTeam.displayName}`,
        division: g.division ?? '',
        bracket: g.bracketCode ?? '',
        status: g.status,
      }

      const missingKinds: Row[] = []
      if (!g.ticketUrl) missingKinds.push({ ...common, missing: 'ticket_link' })
      if (!g.streamUrl) missingKinds.push({ ...common, missing: 'stream_link' })
      return missingKinds
    }),
  ]

  const dedup = new Map<string, Row>()
  for (const r of rows) {
    dedup.set(`${r.gameId}:${r.missing}`, r)
  }

  const prioritized = [...dedup.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.matchup.localeCompare(b.matchup)
  })

  const csvHeader = 'year,game_id,date,matchup,division,bracket,status,missing\n'
  const csvBody = prioritized
    .map(
      (r) =>
        `${r.year},${escapeCsv(r.gameId)},${escapeCsv(r.date)},${escapeCsv(r.matchup)},${escapeCsv(r.division)},${escapeCsv(r.bracket)},${escapeCsv(r.status)},${escapeCsv(r.missing)}`,
    )
    .join('\n')

  const outCsv = path.join(EXPORTS_DIR, 'historical-gap-batch1-priority.csv')
  fs.writeFileSync(outCsv, `${csvHeader}${csvBody}\n`)

  const summary = [
    '# Historical Gap Cleanup — Batch 1',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Final historical games scanned: ${finalGames.length}`,
    `- Missing score rows (final-only): ${scoreMissing.length}`,
    `- Missing link rows (final-only, ticket/stream expanded): ${prioritized.filter((r) => r.missing !== 'score').length}`,
    `- Total prioritized rows: ${prioritized.length}`,
    '',
    'Output:',
    '- `docs/exports/historical-gap-batch1-priority.csv`',
  ].join('\n')

  const outMd = path.join(EXPORTS_DIR, 'historical-gap-batch1-summary.md')
  fs.writeFileSync(outMd, `${summary}\n`)

  console.log('Written:', outCsv)
  console.log('Written:', outMd)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
