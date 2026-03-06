import fs from 'node:fs'
import path from 'node:path'
import { db } from '../src/lib/db'

const EXPORTS_DIR = path.resolve(process.cwd(), 'docs', 'exports')

const STREAM_PENDING_TAG = '[gap] stream_link_pending_partner_clutch'
const SCORE_PENDING_TAG = '[gap] final_score_pending_source_confirmation'

function withTag(notes: string | null | undefined, tag: string): string {
  const base = (notes ?? '').trim()
  if (base.includes(tag)) return base
  return base ? `${base} | ${tag}` : tag
}

async function main() {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true })

  const finalGames = await db.game.findMany({
    where: {
      status: 'final',
      tournament: { year: { lte: 2025 } },
    },
    include: {
      tournament: { select: { year: true } },
      homeTeam: { select: { displayName: true } },
      awayTeam: { select: { displayName: true } },
    },
    orderBy: [{ startTime: 'asc' }],
  })

  const streamMissing = finalGames.filter((g) => !g.streamUrl)
  const scoreMissing = finalGames.filter((g) => g.homeScore == null || g.awayScore == null)

  // Compose note tags per game id first, then write each game once.
  const notesById = new Map<string, { before: string; after: string }>()

  for (const g of streamMissing) {
    const before = notesById.get(g.id)?.after ?? (g.notes ?? '').trim()
    const after = withTag(before, STREAM_PENDING_TAG)
    notesById.set(g.id, { before: (g.notes ?? '').trim(), after })
  }

  for (const g of scoreMissing) {
    const before = notesById.get(g.id)?.after ?? (g.notes ?? '').trim()
    const after = withTag(before, SCORE_PENDING_TAG)
    notesById.set(g.id, { before: (g.notes ?? '').trim(), after })
  }

  let taggedStream = 0
  let taggedScore = 0

  for (const [gameId, notes] of notesById.entries()) {
    if (notes.after === notes.before) continue

    await db.game.update({ where: { id: gameId }, data: { notes: notes.after } })

    if (!notes.before.includes(STREAM_PENDING_TAG) && notes.after.includes(STREAM_PENDING_TAG)) {
      taggedStream += 1
    }
    if (!notes.before.includes(SCORE_PENDING_TAG) && notes.after.includes(SCORE_PENDING_TAG)) {
      taggedScore += 1
    }
  }

  const lines = [
    '# Historical Gap Cleanup — Batch 1 Finalization',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `- Final games scanned (<=2025): ${finalGames.length}`,
    `- Remaining final games missing stream links: ${streamMissing.length}`,
    `- Remaining final games missing scores: ${scoreMissing.length}`,
    `- Stream-gap notes tagged this pass: ${taggedStream}`,
    `- Score-gap notes tagged this pass: ${taggedScore}`,
    '',
    '## Remaining Stream Gaps (partner-blocked)',
    ...streamMissing.map(
      (g) =>
        `- ${g.id} | ${g.tournament.year} | ${g.startTime.toISOString().slice(0, 10)} | ${g.homeTeam.displayName} vs ${g.awayTeam.displayName}`,
    ),
    '',
    '## Remaining Score Gaps (source-blocked)',
    ...scoreMissing.map(
      (g) =>
        `- ${g.id} | ${g.tournament.year} | ${g.startTime.toISOString().slice(0, 10)} | ${g.homeTeam.displayName} vs ${g.awayTeam.displayName}`,
    ),
  ]

  const out = path.join(EXPORTS_DIR, 'historical-gap-batch1-finalization.md')
  fs.writeFileSync(out, `${lines.join('\n')}\n`)
  console.log('Written:', out)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
