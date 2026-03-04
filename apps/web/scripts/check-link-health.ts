#!/usr/bin/env npx tsx
/**
 * Link Health Checker
 * Validates ticketUrl and streamUrl for all games in the active tournament.
 * Outputs a markdown report to docs/LINK-HEALTH-REPORT.md
 *
 * Usage:
 *   cd apps/web && npx tsx scripts/check-link-health.ts
 *   cd apps/web && npx tsx scripts/check-link-health.ts --tournament-id <id>
 */

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const db = new PrismaClient()

interface CheckResult {
  gameId: string
  matchup: string
  date: string
  division: string
  phase: string
  field: 'ticketUrl' | 'streamUrl'
  url: string
  status: number | null
  finalUrl: string | null
  ok: boolean
  error?: string
}

async function checkUrl(url: string): Promise<{ status: number | null; finalUrl: string | null; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'FD-Alumni-Hub-LinkChecker/1.0' },
    })
    clearTimeout(timeout)
    return {
      status: res.status,
      finalUrl: res.url !== url ? res.url : null,
      ok: res.ok,
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // Some servers reject HEAD — try GET with abort after headers
    if (msg.includes('abort') || msg.includes('network')) {
      return { status: null, finalUrl: null, ok: false, error: 'Timeout or network error' }
    }
    try {
      const controller2 = new AbortController()
      const timeout2 = setTimeout(() => controller2.abort(), 8000)
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller2.signal,
        headers: { 'User-Agent': 'FD-Alumni-Hub-LinkChecker/1.0', Range: 'bytes=0-0' },
      })
      clearTimeout(timeout2)
      return { status: res.status, finalUrl: res.url !== url ? res.url : null, ok: res.ok }
    } catch (e2: unknown) {
      return { status: null, finalUrl: null, ok: false, error: e2 instanceof Error ? e2.message : String(e2) }
    }
  }
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

  console.log(`\n🔍 Checking links for: ${tournament.name} ${tournament.year}\n`)

  const games = await db.game.findMany({
    where: { tournamentId: tournament.id },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { startTime: 'asc' },
  })

  const urlsToCheck: { gameId: string; matchup: string; date: string; division: string; phase: string; field: 'ticketUrl' | 'streamUrl'; url: string }[] = []

  for (const g of games) {
    const matchup = `${g.awayTeam.displayName} vs ${g.homeTeam.displayName}`
    const date = new Date(g.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const division = g.division ?? g.homeTeam.division ?? '—'
    const phase = phaseOf(g.bracketCode, g.homeTeam.displayName)
    if (g.ticketUrl) urlsToCheck.push({ gameId: g.id, matchup, date, division, phase, field: 'ticketUrl', url: g.ticketUrl })
    if (g.streamUrl) urlsToCheck.push({ gameId: g.id, matchup, date, division, phase, field: 'streamUrl', url: g.streamUrl })
  }

  const gamesWithoutTicket = games.filter(g => !g.ticketUrl)
  const gamesWithoutStream = games.filter(g => !g.streamUrl)

  if (urlsToCheck.length === 0) {
    console.log('No URLs to check. Add ticket/stream URLs to games first.')
    process.exit(0)
  }

  console.log(`Found ${urlsToCheck.length} URLs to check across ${games.length} games.\n`)

  const results: CheckResult[] = []
  for (let i = 0; i < urlsToCheck.length; i++) {
    const item = urlsToCheck[i]
    process.stdout.write(`  [${i + 1}/${urlsToCheck.length}] ${item.field} — ${item.matchup.slice(0, 50)}... `)
    const check = await checkUrl(item.url)
    const result: CheckResult = { ...item, ...check }
    results.push(result)
    console.log(check.ok ? `✅ ${check.status}` : `❌ ${check.status ?? 'ERR'} ${check.error ?? ''}`)
  }

  // Build report
  const passed = results.filter(r => r.ok)
  const failed = results.filter(r => !r.ok)
  const redirected = results.filter(r => r.ok && r.finalUrl)

  const now = new Date().toISOString()
  const lines: string[] = [
    `# Link Health Report`,
    ``,
    `**Tournament:** ${tournament.name} ${tournament.year}`,
    `**Generated:** ${now}`,
    `**Total URLs checked:** ${results.length}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|--------|-------|`,
    `| ✅ Healthy | ${passed.length} |`,
    `| ❌ Failed | ${failed.length} |`,
    `| ↪️ Redirected | ${redirected.length} |`,
    `| 🎟️ Missing ticket links | ${gamesWithoutTicket.length} |`,
    `| 📺 Missing stream links | ${gamesWithoutStream.length} |`,
    ``,
  ]

  if (failed.length > 0) {
    lines.push(`## ❌ Failed URLs (${failed.length})`, ``)
    lines.push(`| Game | Date | Field | URL | Status | Error |`)
    lines.push(`|------|------|-------|-----|--------|-------|`)
    for (const r of failed) {
      lines.push(`| ${r.matchup} | ${r.date} | ${r.field} | \`${r.url.slice(0, 60)}\` | ${r.status ?? 'ERR'} | ${r.error ?? ''} |`)
    }
    lines.push(``)
  }

  if (redirected.length > 0) {
    lines.push(`## ↪️ Redirected URLs (${redirected.length})`, ``)
    lines.push(`| Game | Date | Field | Original | Final |`)
    lines.push(`|------|------|-------|----------|-------|`)
    for (const r of redirected) {
      lines.push(`| ${r.matchup} | ${r.date} | ${r.field} | \`${r.url.slice(0, 50)}\` | \`${r.finalUrl?.slice(0, 50)}\` |`)
    }
    lines.push(``)
  }

  if (passed.filter(r => !r.finalUrl).length > 0) {
    lines.push(`## ✅ Healthy URLs (${passed.filter(r => !r.finalUrl).length})`, ``)
    lines.push(`| Game | Date | Field | URL | Status |`)
    lines.push(`|------|------|-------|-----|--------|`)
    for (const r of passed.filter(r => !r.finalUrl)) {
      lines.push(`| ${r.matchup} | ${r.date} | ${r.field} | \`${r.url.slice(0, 60)}\` | ${r.status} |`)
    }
    lines.push(``)
  }

  if (gamesWithoutTicket.length > 0) {
    lines.push(`## 🎟️ Games Missing Ticket Links (${gamesWithoutTicket.length})`, ``)
    lines.push(`| Game | Date | Division | Phase |`)
    lines.push(`|------|------|----------|-------|`)
    for (const g of gamesWithoutTicket) {
      const matchup = `${g.awayTeam.displayName} vs ${g.homeTeam.displayName}`
      const date = new Date(g.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const div = g.division ?? g.homeTeam.division ?? '—'
      const phase = phaseOf(g.bracketCode, g.homeTeam.displayName)
      lines.push(`| ${matchup} | ${date} | ${div} | ${phase} |`)
    }
    lines.push(``)
  }

  if (gamesWithoutStream.length > 0) {
    lines.push(`## 📺 Games Missing Stream Links (${gamesWithoutStream.length})`, ``)
    lines.push(`| Game | Date | Division | Phase |`)
    lines.push(`|------|------|----------|-------|`)
    for (const g of gamesWithoutStream) {
      const matchup = `${g.awayTeam.displayName} vs ${g.homeTeam.displayName}`
      const date = new Date(g.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const div = g.division ?? g.homeTeam.division ?? '—'
      const phase = phaseOf(g.bracketCode, g.homeTeam.displayName)
      lines.push(`| ${matchup} | ${date} | ${div} | ${phase} |`)
    }
    lines.push(``)
  }

  const reportPath = resolve(process.cwd(), '../../docs/LINK-HEALTH-REPORT.md')
  writeFileSync(reportPath, lines.join('\n'), 'utf-8')

  console.log(`\n📄 Report saved to: ${reportPath}`)
  console.log(`\n✅ ${passed.length} healthy  ❌ ${failed.length} failed  ↪️ ${redirected.length} redirected\n`)

  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await db.$disconnect()
  process.exit(1)
})
