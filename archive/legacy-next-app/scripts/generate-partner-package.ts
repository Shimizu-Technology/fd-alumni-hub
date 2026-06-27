/**
 * Partner Package V2 Generator
 * 
 * Generates comprehensive exports and reports for partners:
 * - Current data coverage status
 * - Missing links (tickets/streams)
 * - Historical content summary
 * - Champion data
 * - Remaining gaps
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const DOCS_DIR = path.join(process.cwd(), '../../docs')
const EXPORTS_DIR = path.join(DOCS_DIR, 'exports')

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true })
}

async function generateScoreCoverageReport(): Promise<string> {
  const tournaments = await prisma.tournament.findMany({
    include: {
      games: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { year: 'desc' },
  })

  let report = `# Score Coverage Report

**Generated:** ${new Date().toISOString()}

## Summary by Tournament

| Year | Total Games | Scored | Coverage |
|------|-------------|--------|----------|
`

  for (const t of tournaments) {
    const total = t.games.length
    const scored = t.games.filter(g => g.homeScore !== null && g.awayScore !== null).length
    const pct = total > 0 ? ((scored / total) * 100).toFixed(1) : '0.0'
    report += `| ${t.year} | ${total} | ${scored} | ${pct}% |\n`
  }

  // Focus on 2025 (current tournament)
  const current = tournaments.find(t => t.year === 2025)
  if (current) {
    report += `\n## 2025 Tournament Detail\n\n`

    // By division
    const byDivision = new Map<string, { total: number; scored: number }>()
    for (const g of current.games) {
      const div = g.division ?? 'Unknown'
      if (!byDivision.has(div)) {
        byDivision.set(div, { total: 0, scored: 0 })
      }
      const d = byDivision.get(div)!
      d.total++
      if (g.homeScore !== null && g.awayScore !== null) {
        d.scored++
      }
    }

    report += `### By Division\n\n| Division | Scored | Total | Coverage |\n|----------|--------|-------|----------|\n`
    for (const [div, data] of [...byDivision.entries()].sort()) {
      const pct = ((data.scored / data.total) * 100).toFixed(1)
      report += `| ${div} | ${data.scored} | ${data.total} | ${pct}% |\n`
    }

    // Missing scores
    const missing = current.games.filter(g => g.homeScore === null || g.awayScore === null)
    if (missing.length > 0) {
      report += `\n### Missing Scores (${missing.length} games)\n\n`
      report += `| Date | Division | Bracket | Matchup | Status |\n|------|----------|---------|---------|--------|\n`
      for (const g of missing.slice(0, 30)) {
        const date = g.startTime.toISOString().split('T')[0]
        report += `| ${date} | ${g.division ?? '-'} | ${g.bracketCode ?? '-'} | ${g.homeTeam.displayName} vs ${g.awayTeam.displayName} | ${g.status} |\n`
      }
      if (missing.length > 30) {
        report += `\n*...and ${missing.length - 30} more games*\n`
      }
    }
  }

  return report
}

async function generateLinkCoverageReport(): Promise<string> {
  const tournaments = await prisma.tournament.findMany({
    include: {
      games: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { year: 'desc' },
  })

  let report = `# Link Coverage Report

**Generated:** ${new Date().toISOString()}

## Summary

| Tournament | Total | Missing Tickets | Missing Streams |
|------------|-------|-----------------|-----------------|
`

  for (const t of tournaments) {
    const total = t.games.length
    const missingTicket = t.games.filter(g => !g.ticketUrl).length
    const missingStream = t.games.filter(g => !g.streamUrl).length
    report += `| ${t.year} | ${total} | ${missingTicket} | ${missingStream} |\n`
  }

  return report
}

async function generateContentSummary(): Promise<string> {
  const articles = await prisma.articleLink.findMany({
    include: { tournament: true },
    orderBy: [{ tournament: { year: 'desc' } }, { publishedAt: 'desc' }],
  })

  const media = await prisma.mediaAsset.findMany({
    include: { tournament: true },
    orderBy: [{ tournament: { year: 'desc' } }, { takenAt: 'desc' }],
  })

  const ingest = await prisma.contentIngestItem.findMany({
    include: { tournament: true },
  })

  // Group by year
  const byYear = new Map<number, { articles: number; media: number; approved: number; rejected: number; pending: number }>()
  
  for (const a of articles) {
    const year = a.tournament.year
    if (!byYear.has(year)) {
      byYear.set(year, { articles: 0, media: 0, approved: 0, rejected: 0, pending: 0 })
    }
    byYear.get(year)!.articles++
  }

  for (const m of media) {
    const year = m.tournament.year
    if (!byYear.has(year)) {
      byYear.set(year, { articles: 0, media: 0, approved: 0, rejected: 0, pending: 0 })
    }
    byYear.get(year)!.media++
  }

  for (const i of ingest) {
    const year = i.tournament.year
    if (!byYear.has(year)) {
      byYear.set(year, { articles: 0, media: 0, approved: 0, rejected: 0, pending: 0 })
    }
    const d = byYear.get(year)!
    if (i.status === 'approved') d.approved++
    else if (i.status === 'rejected') d.rejected++
    else d.pending++
  }

  let report = `# Historical Content Summary

**Generated:** ${new Date().toISOString()}

## Overview

| Metric | Count |
|--------|-------|
| Total Articles | ${articles.length} |
| Total Media Assets | ${media.length} |
| Ingest Approved | ${ingest.filter(i => i.status === 'approved').length} |
| Ingest Pending | ${ingest.filter(i => i.status === 'pending').length} |
| Ingest Rejected | ${ingest.filter(i => i.status === 'rejected').length} |

## By Year

| Year | Articles | Media | Ingest Status |
|------|----------|-------|---------------|
`

  for (const [year, data] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
    report += `| ${year} | ${data.articles} | ${data.media} | ✅${data.approved} ⏳${data.pending} ❌${data.rejected} |\n`
  }

  // Source breakdown
  const articleSources = new Map<string, number>()
  for (const a of articles) {
    articleSources.set(a.source, (articleSources.get(a.source) ?? 0) + 1)
  }

  const mediaSources = new Map<string, number>()
  for (const m of media) {
    mediaSources.set(m.source, (mediaSources.get(m.source) ?? 0) + 1)
  }

  report += `\n## By Source\n\n### Articles\n| Source | Count |\n|--------|-------|\n`
  for (const [source, count] of [...articleSources.entries()].sort((a, b) => b[1] - a[1])) {
    report += `| ${source} | ${count} |\n`
  }

  report += `\n### Media\n| Source | Count |\n|--------|-------|\n`
  for (const [source, count] of [...mediaSources.entries()].sort((a, b) => b[1] - a[1])) {
    report += `| ${source} | ${count} |\n`
  }

  return report
}

async function generateMissingScoresCsv(): Promise<void> {
  const tournaments = await prisma.tournament.findMany({
    include: {
      games: {
        where: {
          OR: [
            { homeScore: null },
            { awayScore: null },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { year: 'desc' },
  })

  let csv = 'year,date,division,bracket,home_team,away_team,status,notes\n'

  for (const t of tournaments) {
    for (const g of t.games) {
      const date = g.startTime.toISOString().split('T')[0]
      csv += `${t.year},${date},${g.division ?? ''},${g.bracketCode ?? ''},${g.homeTeam.displayName},${g.awayTeam.displayName},${g.status},needs_result\n`
    }
  }

  const filepath = path.join(EXPORTS_DIR, 'missing-scores.csv')
  fs.writeFileSync(filepath, csv)
  console.log(`   Written: ${filepath}`)
}

async function generateMissingLinksCsv(): Promise<void> {
  const tournaments = await prisma.tournament.findMany({
    include: {
      games: {
        include: { homeTeam: true, awayTeam: true },
        orderBy: { startTime: 'asc' },
      },
    },
    orderBy: { year: 'desc' },
  })

  // Ticket links
  let ticketCsv = 'year,game_id,date,time,matchup,division,phase,bracket,venue,status\n'
  // Stream links
  let streamCsv = 'year,game_id,date,time,matchup,division,phase,bracket,venue,status\n'

  for (const t of tournaments) {
    for (const g of t.games) {
      const date = g.startTime.toISOString().split('T')[0]
      const time = g.startTime.toISOString().split('T')[1].substring(0, 5)
      const matchup = `${g.homeTeam.displayName} vs ${g.awayTeam.displayName}`
      const phase = g.bracketCode ? 'Playoffs' : 'Pool'
      
      const row = `${t.year},${g.id},${date},${time},"${matchup}",${g.division ?? ''},${phase},${g.bracketCode ?? ''},${g.venue ?? ''},${g.status}\n`
      
      if (!g.ticketUrl) {
        ticketCsv += row
      }
      if (!g.streamUrl) {
        streamCsv += row
      }
    }
  }

  const ticketPath = path.join(EXPORTS_DIR, 'missing-ticket-links.csv')
  const streamPath = path.join(EXPORTS_DIR, 'missing-stream-links.csv')
  
  fs.writeFileSync(ticketPath, ticketCsv)
  fs.writeFileSync(streamPath, streamCsv)
  
  console.log(`   Written: ${ticketPath}`)
  console.log(`   Written: ${streamPath}`)
}

async function main(): Promise<void> {
  console.log('\n📦 Generating Partner Package V2')
  console.log('━'.repeat(60))

  console.log('\n📊 Generating reports...')
  
  // Generate markdown reports
  const scoreCoverage = await generateScoreCoverageReport()
  fs.writeFileSync(path.join(DOCS_DIR, 'SCORE-COVERAGE-REPORT.md'), scoreCoverage)
  console.log(`   Written: docs/SCORE-COVERAGE-REPORT.md`)

  const linkCoverage = await generateLinkCoverageReport()
  fs.writeFileSync(path.join(DOCS_DIR, 'LINK-COVERAGE-REPORT.md'), linkCoverage)
  console.log(`   Written: docs/LINK-COVERAGE-REPORT.md`)

  const contentSummary = await generateContentSummary()
  fs.writeFileSync(path.join(DOCS_DIR, 'CONTENT-SUMMARY.md'), contentSummary)
  console.log(`   Written: docs/CONTENT-SUMMARY.md`)

  console.log('\n📄 Generating CSV exports...')
  await generateMissingScoresCsv()
  await generateMissingLinksCsv()

  // Generate package manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    version: 'v2',
    reports: [
      'SCORE-COVERAGE-REPORT.md',
      'LINK-COVERAGE-REPORT.md', 
      'CONTENT-SUMMARY.md',
    ],
    exports: [
      'exports/missing-scores.csv',
      'exports/missing-ticket-links.csv',
      'exports/missing-stream-links.csv',
    ],
  }

  fs.writeFileSync(
    path.join(DOCS_DIR, 'PARTNER-PACKAGE-MANIFEST.json'),
    JSON.stringify(manifest, null, 2)
  )
  console.log(`   Written: docs/PARTNER-PACKAGE-MANIFEST.json`)

  console.log('\n✅ Partner Package V2 generated successfully')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
