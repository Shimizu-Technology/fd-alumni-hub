#!/usr/bin/env npx tsx
/**
 * Final-Mile Archive Sweep for FD Alumni Hub
 * 
 * This script performs a comprehensive final-mile sweep to find and ingest
 * additional high-confidence content from GSPN deep archives and embedded
 * photo gallery assets.
 * 
 * Run: npx tsx scripts/historical-ingest-finalmile.ts
 * 
 * Generated: 2026-03-04
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

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

// ================================================================================
// FINAL-MILE DISCOVERED CONTENT
// Priority: GSPN embedded photo galleries, specific article assets
// ================================================================================
const FINALMILE_CONTENT: ContentCandidate[] = [

  // ============================================================================
  // 2019 OPENING NIGHT PHOTO GALLERY (10 images)
  // Source: https://www.guamsportsnetwork.com/2019/2006-beats-2016-alumni-tourney-tips-off/
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-1.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 1',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-2.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 2',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-2.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-3.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 3',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-3.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-4.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 4',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-4.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-5.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 5',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-5.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-6.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 6',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-6.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-7.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 7',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-7.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-8.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 8',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-8.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-9.jpg',
    title: '2006 vs 2016 Opening Night - Action Shot 9',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-9.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Michael Blas - Opening night 2006 vs 2016'
  },

  // ============================================================================
  // 2022 PLAYOFFS BRACKETS & MEDIA (5 images)
  // Source: https://www.guamsportsnetwork.com/2022/fd-alumni-basketball-playoffs-all-set/
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-playoffs1.jpg',
    title: '2022 Maroon Division Playoffs Schedule Day 1',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-playoffs1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official 2022 playoff schedule graphic - Day 1'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-playoffs2.jpg',
    title: '2022 Maroon Division Playoffs Schedule Day 2',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-playoffs2.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official 2022 playoff schedule graphic - Day 2'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-gold-ladder.jpg',
    title: '2022 Gold Division Playoff Bracket',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-gold-ladder.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official 2022 Gold Division bracket'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-maroon-ladder.jpg',
    title: '2022 Maroon Division Playoff Bracket',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-maroon-ladder.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official 2022 Maroon Division bracket'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/WhatsApp-Image-2022-07-13-at-3.22.33-PM.jpeg',
    title: '2022 Semifinals - 2020 vs 2006 Game Action',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/WhatsApp-Image-2022-07-13-at-3.22.33-PM.jpeg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Game photo - 2020 defeats 2006 57-26 in semifinals'
  },

  // ============================================================================
  // 2015 CHAMPIONSHIP PHOTO GALLERY (9 images)
  // Source: https://www.guamsportsnetwork.com/2015/2013-wins-first-ever-fd-alumni-tourney/
  // Photographer: Dan Paran
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-1.jpg',
    title: 'FD Alumni Tribute to Jay Cruz - 2015 Championship',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - FD Alumni tribute to Jay "Juice" Cruz'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-2.jpg',
    title: 'Fr. Jeffrey San Nicolas Pre-Game Tip-Off - 2015',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-2.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - FD principal tosses ceremonial tip-off'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-3.jpg',
    title: '2015 Championship Game Action - 2013 vs 2004',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-3.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - Championship game action'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-4.jpg',
    title: 'John Baza Running Jumper - 2015 Championship',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-4.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - John Baza pulls up for running jumper (23 pts in championship)'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-7.jpg',
    title: '2015 Championship Game Action Shot',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-7.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - 2015 championship game action'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-8.jpg',
    title: 'Class of 2004 Timeout - 2015 Championship',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-8.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - Defending champs 2004 call timeout trailing late'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-9.jpg',
    title: '2015 Championship Post-Game',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-9.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Photo by Dan Paran - 2015 championship conclusion'
  },

  // ============================================================================
  // 2018 CHAMPIONSHIP MEDIA (1 image)
  // Source: https://www.guamsportsnetwork.com/2018/live-video-fd-alumni-tournament-finals/
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-1.jpg',
    title: '2018 Championship Finals - 02/04 vs 2011/12',
    source: 'guamsportsnetwork.com',
    year: 2018,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: '2018 Championship game photo - 02/04 repeats with win over 2011/12'
  },

  // ============================================================================
  // ADDITIONAL 2022 ARTICLE
  // Source: https://www.guamsportsnetwork.com/2022/2020-blows-out-06-in-fd-semifinals/
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/2022/2020-blows-out-06-in-fd-semifinals/',
    title: '2020 Blows Out 06 In FD Semifinals',
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-07-14',
    excerpt: 'The 8-time champion Class of 2006 struggles continued as Class of 2020 handed them a lopsided 57-26 loss. Christian Leon Guerrero scored 22 points. 2020 advances to face 02/04 in finals.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Semifinal recap - 2006 dynasty ends, 2020 advances'
  },

  // ============================================================================
  // 2022 CHAMPIONSHIP ARTICLE
  // Source: Search result confirmation
  // ============================================================================
  {
    url: 'https://www.guamsportsnetwork.com/2022/0204-reclaims-fd-alumni-hoops-reign/',
    title: "02/04 Reclaims FD Alumni Hoops Reign",
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-07-15',
    excerpt: 'Class of 2002/04 wins 5th FD Alumni title with 62-52 victory over Class of 2020. Shaun Perez leads the way.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2022 Championship recap - 02/04 wins 5th title'
  },
]

async function getTournamentForYear(year: number): Promise<string | null> {
  const tournament = await db.tournament.findFirst({
    where: { year },
    select: { id: true }
  })
  return tournament?.id ?? null
}

async function isDuplicate(url: string, imageUrl: string | undefined, tournamentId: string): Promise<boolean> {
  // Check ContentIngestItem by URL
  const existingIngest = await db.contentIngestItem.findFirst({
    where: { tournamentId, url }
  })
  if (existingIngest) return true

  // Check ArticleLink by URL
  const existingArticle = await db.articleLink.findFirst({
    where: { tournamentId, url }
  })
  if (existingArticle) return true

  // Check MediaAsset by imageUrl
  if (imageUrl) {
    const existingMedia = await db.mediaAsset.findFirst({
      where: { tournamentId, imageUrl }
    })
    if (existingMedia) return true

    // Also check URL as imageUrl for media items
    const existingMediaByUrl = await db.mediaAsset.findFirst({
      where: { tournamentId, imageUrl: url }
    })
    if (existingMediaByUrl) return true
  }

  return false
}

interface IngestStats {
  total: number
  approved: number
  pending: number
  rejected: number
  duplicates: number
  noTournament: number
  byYear: Record<number, { articles: number; media: number }>
  bySource: Record<string, number>
}

async function runFinalMileSweep(): Promise<IngestStats> {
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

  console.log('🏀 FD Alumni Hub - Final-Mile Archive Sweep')
  console.log('=' .repeat(60))
  console.log(`Processing ${FINALMILE_CONTENT.length} content items...\n`)

  for (const content of FINALMILE_CONTENT) {
    stats.total++
    
    // Get tournament for year
    const tournamentId = await getTournamentForYear(content.year)
    if (!tournamentId) {
      console.log(`⚠️ NO TOURNAMENT for year ${content.year}: ${content.title}`)
      stats.noTournament++
      continue
    }

    // Check for duplicates
    if (await isDuplicate(content.url, content.imageUrl, tournamentId)) {
      console.log(`⏭️ DUPLICATE: ${content.title}`)
      stats.duplicates++
      continue
    }

    // Initialize year stats
    if (!stats.byYear[content.year]) {
      stats.byYear[content.year] = { articles: 0, media: 0 }
    }

    // Initialize source stats
    if (!stats.bySource[content.source]) {
      stats.bySource[content.source] = 0
    }

    // Determine status and kind
    const status: 'approved' | 'pending' = content.confidence === 'confirmed' ? 'approved' : 'pending'
    const kind: 'media' | 'article' = content.kind === 'media' ? 'media' : 'article'

    // Create ingest item for tracking
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
        notes: content.notes ?? 'final-mile-sweep'
      }
    })

    // If confirmed, create the actual record
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
            articleUrl: content.url.includes('/wp-content/uploads/') 
              ? undefined 
              : content.url,
            caption: content.notes,
            takenAt: content.publishedAt ? new Date(content.publishedAt) : null
          }
        })
        stats.byYear[content.year].media++
      }
      stats.approved++
      console.log(`✅ APPROVED (${kind}): ${content.title}`)
    } else {
      stats.pending++
      console.log(`📋 PENDING (${kind}): ${content.title}`)
    }

    stats.bySource[content.source]++
  }

  return stats
}

async function main() {
  try {
    const stats = await runFinalMileSweep()

    console.log('\n' + '=' .repeat(60))
    console.log('📊 FINAL-MILE SWEEP SUMMARY')
    console.log('=' .repeat(60))
    console.log(`Total processed: ${stats.total}`)
    console.log(`Approved & imported: ${stats.approved}`)
    console.log(`Pending review: ${stats.pending}`)
    console.log(`Duplicates skipped: ${stats.duplicates}`)
    console.log(`No tournament found: ${stats.noTournament}`)

    console.log('\n📅 BY YEAR:')
    const years = Object.keys(stats.byYear).map(Number).sort((a, b) => b - a)
    for (const year of years) {
      const y = stats.byYear[year]
      console.log(`  ${year}: ${y.articles} articles, ${y.media} media`)
    }

    console.log('\n🌐 BY SOURCE:')
    for (const [source, count] of Object.entries(stats.bySource)) {
      console.log(`  ${source}: ${count}`)
    }

    // Write stats to JSON for report generation
    const reportData = {
      timestamp: new Date().toISOString(),
      pass: 'final-mile',
      stats
    }
    
    const fs = await import('fs')
    const path = await import('path')
    const dataDir = path.join(process.cwd(), '..', '..', 'data', 'imports')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(
      path.join(dataDir, 'historical-ingest-finalmile-stats.json'),
      JSON.stringify(reportData, null, 2)
    )
    console.log('\n📄 Stats saved to data/imports/historical-ingest-finalmile-stats.json')

  } catch (error) {
    console.error('❌ Final-mile sweep failed:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

main()
