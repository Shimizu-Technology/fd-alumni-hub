#!/usr/bin/env npx tsx
/**
 * Last 10% Archival Recovery Pass
 * 
 * Aggressive final sweep for FD Alumni Hub historical content.
 * Targets: Social media discovery, Wayback archives, alternate CDN patterns,
 * and cross-source verification.
 * 
 * Run: npx tsx scripts/last-mile-recovery.ts
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

interface RecoveryCandidate {
  url: string
  title: string
  source: string
  year: number
  publishedAt?: string
  imageUrl?: string
  excerpt?: string
  confidence: 'confirmed' | 'review-required'
  kind: 'article' | 'media'
  notes?: string
  recoveryMethod: string
}

// Newly discovered content from last-mile recovery pass
const RECOVERED_CONTENT: RecoveryCandidate[] = [
  // 2008 Tournament - PostGuam.com (NEW SOURCE)
  {
    url: 'https://www.postguam.com/sports/local/fdms-alumni-basketball-tournament-begins-tomorrow/article_9aeccdf9-1071-52c5-b595-4bb65084c9de.html',
    title: 'FDMS Alumni Basketball Tournament Begins Tomorrow',
    source: 'postguam.com',
    year: 2008,
    publishedAt: '2008-07-04',
    excerpt: "The Father Duenas Memorial School Class of 1998 is proud to announce the commencement of the 2008 FDMS Alumni Basketball Tournament, which is set to begin bright and early tomorrow at 8 a.m.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2008 tournament announcement - hosted by Class of 1998. Contains amusing "no dunking" rule.',
    recoveryMethod: 'cross-source-search'
  },
  {
    url: 'https://www.postguam.com/sports/local/99-97-survives-against-01-49-43/article_da3c3bf6-dd59-5811-bd64-0509848c6384.html',
    title: "'99/'97 Survives Against '01, 49-43",
    source: 'postguam.com',
    year: 2008,
    publishedAt: '2008-07-09',
    excerpt: "Day five of the 2008 FDMS Alumni Basketball Tournament. '99/'97 took on an undermanned '01 squad. Shane Ngata and Corey Diaz hit crucial free throws down the stretch.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2008 Day 5 recap. Also includes scores: Class of 98 (68) def. Class of 89 (58), Class of 02 (58) def. Class of 05 (39). Vince Quitugua scored 36 points.',
    recoveryMethod: 'cross-source-search'
  },
  {
    url: 'https://www.postguam.com/sports/local/99-97-downs-02-44-35-95-set-to-challenge-99-97-for-title/article_d0c41798-5f84-5448-97d0-5d8c7aa60330.html',
    title: "'99/'97 Downs '02, 44-35: '95 Set to Challenge '99/'97 for Title",
    source: 'postguam.com',
    year: 2008,
    publishedAt: '2008-07-25',
    excerpt: "Intense semifinal action. '99/'97 held on to defeat '02, 44-35. Shane Ngata scored hard earned buckets. '95 ended the Cinderella run of '79/'80 36-32. E.J. Calvo led with 18 points. Championship set for tonight.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2008 semifinals recap. Key players: Shaun Perez (02), Shane Ngata (99/97), E.J. Calvo (95). Finals: 99/97 vs 95.',
    recoveryMethod: 'cross-source-search'
  }
]

// Recovery attempts that were blocked/unsuccessful
const BLOCKED_RECOVERIES = [
  {
    target: '2016 FD Alumni Championship',
    methods: ['GSPN search', 'Wayback Machine', 'GuamPDN', 'PostGuam', 'Facebook public search'],
    result: 'No content found. Tournament either not held, or coverage never published online.',
    conclusion: 'Source-side issue - content does not exist in any accessible archive'
  },
  {
    target: 'YouTube FD Alumni specific videos',
    methods: ['YouTube direct search', 'Clutch Guam channel scan'],
    result: 'Only index pages and generic "Final Score" daily shows found',
    conclusion: 'No specific FD Alumni game videos exist on YouTube'
  },
  {
    target: 'Facebook/Instagram FD Alumni posts',
    methods: ['Public search via web', 'Facebook group discovery'],
    result: 'Groups exist but content not publicly indexable',
    conclusion: 'Requires manual extraction or FDMSAA partnership'
  },
  {
    target: '2017 Championship Article',
    methods: ['GSPN URL patterns', 'Wayback Machine'],
    result: '404 confirmed - article deleted from GSPN',
    conclusion: 'Content existed but was removed; no archive available'
  }
]

// Score hints extracted from recovered articles
const SCORE_HINTS = [
  { year: 2008, matchup: "'99/'97 vs '01", score: '49-43', source: 'postguam.com' },
  { year: 2008, matchup: "'99/'97 vs '02 (semis)", score: '44-35', source: 'postguam.com' },
  { year: 2008, matchup: "'95 vs '79/'80 (semis)", score: '36-32', source: 'postguam.com' },
  { year: 2008, matchup: "Class of '98 vs Class of '89", score: '68-58', source: 'postguam.com' },
  { year: 2008, matchup: "Class of '02 vs Class of '05", score: '58-39', source: 'postguam.com' },
  { year: 2008, championship: "'99/'97 vs '95", score: 'TBD - game scheduled', source: 'postguam.com' },
]

async function main() {
  console.log('🔍 Last 10% Archival Recovery Pass')
  console.log('==================================\n')

  // Check for existing content to avoid duplicates
  const existingUrls = await db.contentIngestItem.findMany({
    select: { url: true }
  })
  const existingUrlSet = new Set(existingUrls.map(item => item.url))

  let imported = 0
  let skipped = 0

  // Get or create 2008 tournament
  let tournament2008 = await db.tournament.findFirst({
    where: { year: 2008 }
  })

  if (!tournament2008) {
    tournament2008 = await db.tournament.create({
      data: {
        name: 'FD Alumni Basketball Tournament',
        year: 2008,
        startDate: new Date('2008-07-05'),
        endDate: new Date('2008-08-03'),
        status: 'completed'
      }
    })
    console.log('✅ Created 2008 tournament record')
  }

  for (const content of RECOVERED_CONTENT) {
    if (existingUrlSet.has(content.url)) {
      console.log(`⏭️  Already exists: ${content.title}`)
      skipped++
      continue
    }

    // Add to ingest queue
    await db.contentIngestItem.create({
      data: {
        url: content.url,
        title: content.title,
        source: content.source,
        kind: content.kind === 'article' ? 'article' : 'media',
        status: 'approved',
        confidence: content.confidence === 'confirmed' ? 'high' : 'medium',
        notes: `[Last-mile recovery: ${content.recoveryMethod}] ${content.notes || ''}`,
        tournamentId: tournament2008.id,
        imageUrl: content.imageUrl,
        excerpt: content.excerpt
      }
    })

    // Also add to ArticleLink table
    if (content.kind === 'article') {
      await db.articleLink.create({
        data: {
          title: content.title,
          url: content.url,
          source: content.source,
          tournamentId: tournament2008.id,
          publishedAt: content.publishedAt ? new Date(content.publishedAt) : undefined,
          imageUrl: content.imageUrl
        }
      })
    }

    console.log(`✅ Imported: ${content.title} (${content.year})`)
    imported++
  }

  console.log('\n📊 Recovery Summary')
  console.log('==================')
  console.log(`New content imported: ${imported}`)
  console.log(`Already existed (skipped): ${skipped}`)
  console.log(`Blocked recoveries: ${BLOCKED_RECOVERIES.length}`)
  console.log(`Score hints extracted: ${SCORE_HINTS.length}`)

  console.log('\n🚫 Blocked Recovery Attempts:')
  for (const blocked of BLOCKED_RECOVERIES) {
    console.log(`  - ${blocked.target}: ${blocked.conclusion}`)
  }

  console.log('\n📝 New Score Hints (2008):')
  for (const hint of SCORE_HINTS) {
    console.log(`  - ${hint.matchup}: ${hint.score}`)
  }

  // Generate report data
  const report = {
    timestamp: new Date().toISOString(),
    imported,
    skipped,
    blockedRecoveries: BLOCKED_RECOVERIES.length,
    scoreHintsExtracted: SCORE_HINTS.length,
    newYearsCovered: [2008],
    newSources: ['postguam.com'],
    recoveredContent: RECOVERED_CONTENT,
    blockedAttempts: BLOCKED_RECOVERIES,
    scoreHints: SCORE_HINTS
  }

  // Write report to JSON
  const fs = await import('fs')
  const path = await import('path')
  const reportPath = path.join(__dirname, '../../..', 'data/imports/last-mile-recovery-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(`\n✅ Report written to ${reportPath}`)

  await db.$disconnect()
}

main().catch(console.error)
