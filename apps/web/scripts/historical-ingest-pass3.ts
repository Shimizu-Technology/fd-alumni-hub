#!/usr/bin/env npx tsx
/**
 * Historical Content Acquisition - Pass 3
 * Additional content discovered from deep-digging research (2026-03-04)
 * 
 * Focus areas:
 * - GSPN archive patterns by year
 * - 2014 detailed playoff coverage
 * - 2023 championship article (verified)
 * - GuamPDN year-end recap
 */

import { PrismaClient, IngestKind, IngestStatus } from '@prisma/client'

const db = new PrismaClient()

const ALLOWLIST_DOMAINS = [
  'guamsportsnetwork.com',
  'clutchguam.com',
  'guampdn.com',
]

interface ContentCandidate {
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
}

// Additional content discovered in Pass 3 deep-digging research
const DISCOVERED_CONTENT: ContentCandidate[] = [
  // 2023 - Championship Article (CONFIRMED - fetched and verified)
  {
    url: 'https://www.guamsportsnetwork.com/2023/class-of-2013-kings-of-friarfest/',
    title: 'Class of 2013 Kings of FriarFest',
    source: 'guamsportsnetwork.com',
    year: 2023,
    publishedAt: '2023-07-23',
    excerpt: "Class of 2013 won their second title while hosting the tournament. 2013 beat 2022 in championship. Gold Division: 99/01 beat 98/00 59-34. Michael Sakazaki was Championship Game Player of the Game.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2023 Championship recap - 2013 wins 2nd title while hosting'
  },

  // 2014 - Detailed Playoff Coverage (CONFIRMED - fetched and verified)
  {
    url: 'https://www.guamsportsnetwork.com/2014/2004-to-play-2012-in-alumni-finals/',
    title: '2004 To Play 2012 In Alumni Finals',
    source: 'guamsportsnetwork.com',
    year: 2014,
    publishedAt: '2014-07-18',
    excerpt: "FD Alumni Tournament Final Four coverage. 2004 beat 2009 57-50 (Stinnett 29 pts). Championship set: 2004 vs 2012.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2014 Semifinals recap - includes championship matchup preview'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2014/buzzer-beater-sends-0203-packing/',
    title: 'Buzzer Beater Sends 02/03 Packing',
    source: 'guamsportsnetwork.com',
    year: 2014,
    publishedAt: '2014-07-14',
    excerpt: "Goro Borja game-winning three pointer as time expired. 2009 def 02/03 50-49. Dom Sablan 23 pts. Sean Perez 27 pts in loss.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2014 Playoff game - dramatic buzzer beater finish'
  },

  // 2024 - Year-End Recap mentioning 16/17 Championship
  {
    url: 'https://www.guamsportsnetwork.com/2024/2024-recap-of-guam-sports/',
    title: '2024 Recap of Guam Sports',
    source: 'guamsportsnetwork.com',
    year: 2024,
    publishedAt: '2024-12-28',
    excerpt: "Year-end recap includes: Class of 16/17 wins FD Alumni Basketball Tournament in dramatic fashion with Leon Shimizu buzzer-beater.",
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Year-end recap mentioning FD Alumni championship'
  },

  // GuamPDN - 2025 Year-End Sports Stories (mentions FD Alumni)
  {
    url: 'https://www.guampdn.com/sports/top-10-sports-stories-of-2025-geckos-football-gets-1/article_0b1e68aa-8654-470a-8e12-a44274c6561d.html',
    title: 'Top 10 Sports Stories of 2025',
    source: 'guampdn.com',
    year: 2025,
    publishedAt: '2025-12-19',
    excerpt: "GuamPDN year-end recap. Mentions: 02/04 won 4th FD Alumni Basketball Tournament championship with 50-44 win over Class of 2013.",
    confidence: 'confirmed',
    kind: 'article',
    notes: 'GuamPDN year-end - confirms 2025 champion (02/04) with score'
  },

  // 2019 Opening Night Article (already discovered but confirming)
  {
    url: 'https://www.guamsportsnetwork.com/2019/2006-beats-2016-alumni-tourney-tips-off/',
    title: '2006 Beats 2016 As Alumni Tourney Tips Off',
    source: 'guamsportsnetwork.com',
    year: 2019,
    publishedAt: '2019-06-21',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-10.jpg',
    excerpt: '2006 won 68-64 over 2016. Julius Yu 19 pts, Frankie Tenorio 24 pts. 02/04 beat 2012 62-52 (Sean Perez 19 pts). 79/80/81 beat 86/86 47-35.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2019 Opening night - three game scores documented'
  },

  // Additional Media Assets from articles
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_2059.jpg',
    title: 'William Stinnett 2014 Semifinals',
    source: 'guamsportsnetwork.com',
    year: 2014,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_2059.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Willie Stinnett 29 points to send 2004 to finals'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_5220.jpg',
    title: 'Chris Carbullido 3-pointer 2014',
    source: 'guamsportsnetwork.com',
    year: 2014,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_5220.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: '2008 vs 2004 game action - transition 3-pointer'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2023/07/Michael-Sakazaki-came-up-huge-for-his-class-pouring-in-17-points-and-three-3-pointers_-scaled.jpg',
    title: 'Michael Sakazaki 2023 Championship MVP',
    source: 'guamsportsnetwork.com',
    year: 2023,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2023/07/Michael-Sakazaki-came-up-huge-for-his-class-pouring-in-17-points-and-three-3-pointers_-scaled.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship Game Player of the Game - 17 pts, 3 threes'
  },
]

function isAllowedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return ALLOWLIST_DOMAINS.some(d => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

async function getTournamentForYear(year: number): Promise<string | null> {
  const tournament = await db.tournament.findFirst({
    where: { year },
    select: { id: true }
  })
  return tournament?.id ?? null
}

async function isDuplicate(url: string, tournamentId: string): Promise<boolean> {
  const existingArticle = await db.articleLink.findFirst({
    where: { tournamentId, url }
  })
  if (existingArticle) return true

  const existingIngest = await db.contentIngestItem.findFirst({
    where: { tournamentId, url }
  })
  if (existingIngest) return true

  const existingMedia = await db.mediaAsset.findFirst({
    where: { tournamentId, imageUrl: url }
  })
  if (existingMedia) return true

  return false
}

interface IngestStats {
  total: number
  approved: number
  pending: number
  rejected: number
  duplicates: number
  noTournament: number
  byYear: Record<number, { articles: number; media: number; pending: number }>
  bySource: Record<string, number>
}

async function runIngestion(): Promise<IngestStats> {
  const stats: IngestStats = {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    duplicates: 0,
    noTournament: 0,
    byYear: {},
    bySource: {}
  }

  console.log('🏀 FD Alumni Hub Historical Content Ingestion - Pass 3')
  console.log('=' .repeat(50))
  console.log(`Processing ${DISCOVERED_CONTENT.length} content items...\n`)

  for (const content of DISCOVERED_CONTENT) {
    stats.total++
    
    if (!isAllowedDomain(content.url)) {
      console.log(`❌ REJECTED (domain not allowed): ${content.url}`)
      stats.rejected++
      continue
    }

    const tournamentId = await getTournamentForYear(content.year)
    if (!tournamentId) {
      console.log(`⚠️ NO TOURNAMENT for year ${content.year}: ${content.title}`)
      stats.noTournament++
      continue
    }

    if (await isDuplicate(content.url, tournamentId)) {
      console.log(`⏭️ DUPLICATE: ${content.title}`)
      stats.duplicates++
      continue
    }

    if (!stats.byYear[content.year]) {
      stats.byYear[content.year] = { articles: 0, media: 0, pending: 0 }
    }

    if (!stats.bySource[content.source]) {
      stats.bySource[content.source] = 0
    }

    const status: IngestStatus = content.confidence === 'confirmed' ? 'approved' : 'pending'
    const kind: IngestKind = content.kind === 'media' ? 'media' : 'article'

    await db.contentIngestItem.create({
      data: {
        tournamentId,
        kind,
        status,
        source: content.source,
        title: content.title,
        url: content.url,
        imageUrl: content.imageUrl,
        excerpt: content.excerpt,
        confidence: content.confidence,
        notes: content.notes ?? 'historical-ingest-pass3'
      }
    })

    if (status === 'approved') {
      if (kind === 'article') {
        await db.articleLink.create({
          data: {
            tournamentId,
            title: content.title,
            source: content.source,
            url: content.url,
            imageUrl: content.imageUrl,
            excerpt: content.excerpt,
            publishedAt: content.publishedAt ? new Date(content.publishedAt) : null
          }
        })
        stats.byYear[content.year].articles++
      } else {
        await db.mediaAsset.create({
          data: {
            tournamentId,
            source: content.source,
            title: content.title,
            imageUrl: content.imageUrl ?? content.url,
            articleUrl: content.url,
            caption: content.notes,
            takenAt: content.publishedAt ? new Date(content.publishedAt) : null
          }
        })
        stats.byYear[content.year].media++
      }
      stats.approved++
      console.log(`✅ APPROVED (${kind}): ${content.title}`)
    } else {
      stats.byYear[content.year].pending++
      stats.pending++
      console.log(`📋 PENDING (${kind}): ${content.title}`)
    }

    stats.bySource[content.source]++
  }

  return stats
}

async function main() {
  try {
    const stats = await runIngestion()

    console.log('\n' + '=' .repeat(50))
    console.log('📊 INGESTION SUMMARY (Pass 3 - Deep Digging)')
    console.log('=' .repeat(50))
    console.log(`Total processed: ${stats.total}`)
    console.log(`Approved & imported: ${stats.approved}`)
    console.log(`Pending review: ${stats.pending}`)
    console.log(`Rejected: ${stats.rejected}`)
    console.log(`Duplicates skipped: ${stats.duplicates}`)
    console.log(`No tournament found: ${stats.noTournament}`)

    console.log('\n📅 BY YEAR:')
    const years = Object.keys(stats.byYear).map(Number).sort((a, b) => b - a)
    for (const year of years) {
      const y = stats.byYear[year]
      console.log(`  ${year}: ${y.articles} articles, ${y.media} media, ${y.pending} pending`)
    }

    console.log('\n🌐 BY SOURCE:')
    for (const [source, count] of Object.entries(stats.bySource)) {
      console.log(`  ${source}: ${count}`)
    }

    // Update stats file
    const fs = await import('fs')
    const path = await import('path')
    const dataDir = path.join(process.cwd(), '..', '..', 'data', 'imports')
    fs.mkdirSync(dataDir, { recursive: true })
    
    const reportData = {
      timestamp: new Date().toISOString(),
      pass: 3,
      stats
    }
    fs.writeFileSync(
      path.join(dataDir, 'historical-ingest-pass3-stats.json'),
      JSON.stringify(reportData, null, 2)
    )
    console.log('\n📄 Stats saved to data/imports/historical-ingest-pass3-stats.json')

  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

main()
