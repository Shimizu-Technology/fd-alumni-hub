#!/usr/bin/env npx tsx
/**
 * Missing Links Export
 * Generates CSV files for games missing ticket and/or stream links.
 * Saves to docs/exports/ for sharing with Clutch and GuamTime partners.
 *
 * Usage:
 *   cd apps/web && npx tsx scripts/export-missing-links.ts
 *   cd apps/web && npx tsx scripts/export-missing-links.ts --tournament-id <id>
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

const db = new PrismaClient()

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(...cells: (string | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',')
}

function phaseOf(bracketCode: string | null, teamName: string): string {
  if (bracketCode === 'FS' || /\bFS\b/i.test(teamName)) return 'Father-Son'
  if (bracketCode) return `Playoff (${bracketCode})`
  return 'Pool'
}

async function main() {
  const args = process.argv.slice(2)
  const tIdx = args.indexOf('--tournament-id')
  const tournamentId = tIdx !== -1 ? args[tIdx + 1] : null

  const tournament = tournamentId
    ? await db.tournament.findUnique({ where: { id: tournamentId } })
    : await db.tournament.findFirst({ orderBy: [{ year: 'desc' }, { startDate: 'desc' }] })

  if (!tournament) {
    console.error('No tournament found.')
    process.exit(1)
  }

  console.log(`\n📊 Exporting missing links for: ${tournament.name} ${tournament.year}\n`)

  const games = await db.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
  })

  const headers = row('Game ID', 'Date', 'Time', 'Away Team', 'Home Team', 'Division', 'Phase', 'Bracket Code', 'Venue', 'Status', 'Missing Fields')

  const missingTicket = games.filter(g => !g.ticketUrl)
  const missingStream = games.filter(g => !g.streamUrl)

  const toRow = (g: typeof games[0], missingField: string) => row(
    g.id,
    new Date(g.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    new Date(g.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    g.awayTeam.displayName,
    g.homeTeam.displayName,
    g.division ?? g.homeTeam.division ?? '',
    phaseOf(g.bracketCode, g.homeTeam.displayName),
    g.bracketCode ?? '',
    g.venue ?? '',
    g.status,
    missingField,
  )

  // CSV 1: Missing ticket links (for GuamTime)
  const ticketLines = [
    `# FD Alumni Hub — Games Missing Ticket Links`,
    `# Tournament: ${tournament.name} ${tournament.year}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Partner: GuamTime (ticketing)`,
    `# Total: ${missingTicket.length} of ${games.length} games`,
    headers,
    ...missingTicket.map(g => toRow(g, 'ticketUrl')),
  ]

  // CSV 2: Missing stream links (for Clutch)
  const streamLines = [
    `# FD Alumni Hub — Games Missing Stream Links`,
    `# Tournament: ${tournament.name} ${tournament.year}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Partner: Clutch (streaming)`,
    `# Total: ${missingStream.length} of ${games.length} games`,
    headers,
    ...missingStream.map(g => toRow(g, 'streamUrl')),
  ]

  const exportsDir = resolve(process.cwd(), '../../docs/exports')
  mkdirSync(exportsDir, { recursive: true })

  const slug = `${tournament.year}-${tournament.name.toLowerCase().replace(/\s+/g, '-')}`
  const ticketPath = resolve(exportsDir, `${slug}-missing-ticket-links.csv`)
  const streamPath = resolve(exportsDir, `${slug}-missing-stream-links.csv`)

  writeFileSync(ticketPath, ticketLines.join('\n'), 'utf-8')
  writeFileSync(streamPath, streamLines.join('\n'), 'utf-8')

  console.log(`✅ Exported ${missingTicket.length} games missing ticket links → ${ticketPath}`)
  console.log(`✅ Exported ${missingStream.length} games missing stream links → ${streamPath}`)
  console.log(`\n📁 Files in: ${exportsDir}\n`)

  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
