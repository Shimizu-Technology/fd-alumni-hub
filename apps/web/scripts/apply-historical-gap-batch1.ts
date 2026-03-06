import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { db } from '../src/lib/db'

const EXPORTS_DIR = path.resolve(process.cwd(), 'docs', 'exports')
const PRIORITY_CSV = path.join(EXPORTS_DIR, 'historical-gap-batch1-priority.csv')
const GUAMTIME_EVENT_URL = 'https://events.guamtime.net/event/fd-alumni-basketball-tournament-2025'
const MAX_UPDATES = 10

type PriorityRow = {
  year: number
  gameId: string
  status: string
  missing: string
}

function parseCsvRows(raw: string): PriorityRow[] {
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>

  return records.map((r) => ({
    year: Number(r.year),
    gameId: r.game_id,
    status: r.status,
    missing: r.missing,
  }))
}

async function countFinalMissingTicketLinks() {
  return db.game.count({
    where: {
      status: 'final',
      tournament: { year: { lte: 2025 } },
      ticketUrl: null,
    },
  })
}

async function main() {
  if (!fs.existsSync(PRIORITY_CSV)) {
    throw new Error(`Missing priority CSV: ${PRIORITY_CSV}`)
  }

  const beforeMissing = await countFinalMissingTicketLinks()

  const rows = parseCsvRows(fs.readFileSync(PRIORITY_CSV, 'utf8'))
  const candidates = rows.filter(
    (r) => r.year <= 2025 && r.status === 'final' && r.missing === 'ticket_link',
  )

  const uniqueGameIds = [...new Set(candidates.map((r) => r.gameId))].slice(0, MAX_UPDATES)

  let updated = 0
  const updatedIds: string[] = []
  for (const gameId of uniqueGameIds) {
    const game = await db.game.findUnique({ where: { id: gameId }, select: { ticketUrl: true } })
    if (!game) continue
    if (game.ticketUrl) continue

    await db.game.update({
      where: { id: gameId },
      data: { ticketUrl: GUAMTIME_EVENT_URL },
    })
    updatedIds.push(gameId)
    updated += 1
  }

  const afterMissing = await countFinalMissingTicketLinks()

  const report = [
    '# Historical Gap Cleanup — Batch 1 Execution',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Ticket URL applied value: ${GUAMTIME_EVENT_URL}`,
    `- Target final games attempted: ${uniqueGameIds.length}`,
    `- Successful game updates: ${updated}`,
    `- Final games missing ticket links (before): ${beforeMissing}`,
    `- Final games missing ticket links (after): ${afterMissing}`,
    `- Delta resolved this pass: ${beforeMissing - afterMissing}`,
    '',
    'Updated game IDs:',
    ...(updatedIds.length > 0 ? updatedIds.map((id) => `- ${id}`) : ['- none']),
  ].join('\n')

  const outPath = path.join(EXPORTS_DIR, 'historical-gap-batch1-execution.md')
  fs.writeFileSync(outPath, `${report}\n`)
  console.log('Written:', outPath)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
