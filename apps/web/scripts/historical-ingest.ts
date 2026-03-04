#!/usr/bin/env npx tsx
/**
 * Historical Content Acquisition Script for FD Alumni Hub
 * 
 * This script performs a comprehensive sweep of allowlisted sources
 * to populate historical articles, media, and video references.
 * 
 * Sources (priority order):
 * 1. GSPN (guamsportsnetwork.com)
 * 2. Clutch (clutchguam.com)
 * 3. GuamPDN (guampdn.com)
 * 
 * Run: npx tsx scripts/historical-ingest.ts
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

// Comprehensive list of discovered FD Alumni content
const DISCOVERED_CONTENT: ContentCandidate[] = [
  // 2025 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2025/fd-alumni-tourney-coming-to-a-close/',
    title: 'FD Alumni Tourney Coming to a Close',
    source: 'guamsportsnetwork.com',
    year: 2025,
    publishedAt: '2025-07-15',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2025/07/fd-alumni-2025-close.jpg',
    excerpt: 'The FD alumni basketball tournament culminates this weekend, Friday July 18 with a highly competitive and entertaining Championship game at the Jungle.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Championship preview article for 2025 tournament'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2025/fd-alumni-hoops-opens-with-a-bang/',
    title: 'FD Alumni Hoops Opens With a Bang',
    source: 'guamsportsnetwork.com',
    year: 2025,
    publishedAt: '2025-06-28',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2025/06/WhatsApp-Image-2025-06-27-at-11.15.25-PM-1024x683.jpeg',
    excerpt: 'The newly graduated class of 2025 defeated the defending champions 2016/2017 in their debut game 64-51.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Opening night recap - 2025 defeats defending champs'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2025/results-from-this-weeks-fd-alumni-hoops-tourney/',
    title: "Results from This Week's FD Alumni Hoops Tourney",
    source: 'guamsportsnetwork.com',
    year: 2025,
    publishedAt: '2025-07-04',
    excerpt: 'Weekly results from the 2025 FD Alumni Basketball Tournament including scores and standout players.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Weekly results roundup with game scores'
  },
  
  // 2024 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2024/shimizu-adds-instant-lore-to-fd-alumni-tradition/',
    title: 'Shimizu Adds Instant Lore to FD Alumni Tradition',
    source: 'guamsportsnetwork.com',
    year: 2024,
    publishedAt: '2024-07-20',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2024/07/DSC0928-Enhanced-NR-scaled-e1721402598255.jpg',
    excerpt: "Add Leon Shimizu to the legends list. Class of 2017's Shimizu hit a mid-range jumper that bounced off the rim four times as time expired, handing Class of 16/17 their first title 58-56.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2024 Championship game recap - 16/17 wins first title'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2024/fd-alumni-hoops-its-that-time-again/',
    title: "FD Alumni Hoops: It's That Time Again!",
    source: 'guamsportsnetwork.com',
    year: 2024,
    publishedAt: '2024-06-27',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2024/06/FD-Alumni.jpg',
    excerpt: 'The annual FDMSAA Alumni Basketball Tournament, hosted by the Class of 2014, entering its 40th year. GSPN previews the favorites, contenders, and Cinderellas.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2024 Tournament preview with team breakdowns'
  },

  // 2023 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2023/opening-night-of-2023-fd-basketball-tournament/',
    title: 'Opening Night of 2023 FD Basketball Tournament',
    source: 'guamsportsnetwork.com',
    year: 2023,
    publishedAt: '2023-07-02',
    excerpt: 'Opening night kicked off Friday night at The Jungle. Class of 16/17 destroyed Class of 2018 100-32 with Devin Sudo scoring 34 points.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Opening night recap - includes gold division games'
  },

  // 2022 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2022/fd-alumni-basketball-playoffs-all-set/',
    title: 'FD Alumni Basketball Playoffs All Set',
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-07-05',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-playoffs1.jpg',
    excerpt: 'FDMSAA releases official playoff schedule. GSPN breaks down intriguing first round matchups including 2002/04 vs 2013 and 2006 vs 2021.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Playoff schedule and matchup preview'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2022/8-time-fd-champs-taken-down/',
    title: '8-Time FD Champs Taken Down',
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-06-30',
    excerpt: 'Class of 2002/04 took down the mighty 2006 team 72-62 in a rematch of the 2021 championship game.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Pool play upset - 02/04 defeats 8-time champs 2006'
  },

  // 2021 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2021/2006-brings-in-eighth-alumni-title-in-big-way/',
    title: '2006 Brings In Eighth Alumni Title In Big Way',
    source: 'guamsportsnetwork.com',
    year: 2021,
    publishedAt: '2021-07-30',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-18.jpg',
    excerpt: "Class of 2006 crowned champs again with 58-38 win over 02/04. Rob Leon Guerrero and AJ Reyes led with 12 points each.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2021 Championship recap - 2006 wins 8th title'
  },

  // 2019 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2019/2006-beats-2016-alumni-tourney-tips-off/',
    title: '2006 Beats 2016 As Alumni Tourney Tips Off',
    source: 'guamsportsnetwork.com',
    year: 2019,
    publishedAt: '2019-06-21',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-10.jpg',
    excerpt: 'Six time Alumni Champion 2006 took the win 68-64 over 2016 in opening night thriller. Julius Yu scored 19 points, Frankie Tenorio led all scorers with 24.',
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Opening night 2019 - classic 2006 vs 2016 matchup'
  },

  // 2018 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2018/live-video-fd-alumni-tournament-finals/',
    title: '2002/04 Repeat As FD Alumni Champions',
    source: 'guamsportsnetwork.com',
    year: 2018,
    publishedAt: '2018-07-14',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-1.jpg',
    excerpt: 'Class of 2002/04 cruised to victory over 2011/12. Sean Perez led with 21 points, Willie Stinnett added 14. Gold Division: Class of 1991 won 42-34.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2018 Championship recap - 02/04 repeats, includes Gold Division'
  },

  // 2017 Articles (CONFIRMED - related to alumni)
  {
    url: 'https://www.guamsportsnetwork.com/2017/friars-retire-six-basketball-jereseys/',
    title: 'Friars Retire Six Basketball Jerseys',
    source: 'guamsportsnetwork.com',
    year: 2017,
    publishedAt: '2017-02-09',
    excerpt: "FD Friar Alumni Association hosted its first ever retirement ceremony at Phoenix Center. Retired: Ricardo Eusebio #33 (1972), Eduardo 'Champ' Calvo #10 (1974), and four others.",
    confidence: 'confirmed',
    kind: 'article',
    notes: 'Historic jersey retirement ceremony by FD Alumni Association'
  },

  // 2015 Articles (CONFIRMED)
  {
    url: 'https://www.guamsportsnetwork.com/2015/2013-wins-first-ever-fd-alumni-tourney/',
    title: '2013 Wins First Ever FD Alumni Tourney',
    source: 'guamsportsnetwork.com',
    year: 2015,
    publishedAt: '2015-06-27',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-11.jpg',
    excerpt: "30th annual Father Duenas Alumni Basketball. Class of 2013 defeated defending champion 2004 60-48. John Baza led with 23 points. Includes complete historical champions list 1985-2015.",
    confidence: 'confirmed',
    kind: 'article',
    notes: '2015 Championship - 2013 first title, historical champions list included'
  },

  // 2014 Articles (review-required - need to verify)
  {
    url: 'https://www.guamsportsnetwork.com/2014/fd-alumni-basketball-tournament/',
    title: 'FD Alumni Basketball Tournament 2014',
    source: 'guamsportsnetwork.com',
    year: 2014,
    confidence: 'review-required',
    kind: 'article',
    notes: 'Potential 2014 tournament coverage - needs URL verification'
  },

  // Media Assets (CONFIRMED images from articles)
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2024/07/DSC0928-Enhanced-NR-scaled-e1721402598255.jpg',
    title: 'Leon Shimizu Championship Winning Shot - 2024',
    source: 'guamsportsnetwork.com',
    year: 2024,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2024/07/DSC0928-Enhanced-NR-scaled-e1721402598255.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship winning shot photo - Leon Shimizu'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-8.jpg',
    title: 'Jungle Crowd - 2021 Championship',
    source: 'guamsportsnetwork.com',
    year: 2021,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-8.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship game crowd at The Jungle'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-10.jpg',
    title: '2006 vs 2016 Opening Night - 2019',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-10.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Game action photo - 2006 vs 2016'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-11.jpg',
    title: 'Class of 2013 Championship Trophy - 2015',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-11.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship trophy presentation - Class of 2013'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-5.jpg',
    title: 'Michael Sakazaki vs Dave Tuncap - 2015 Finals',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-5.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Game action - 2013 vs 2004 championship'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-gold-ladder.jpg',
    title: '2022 Gold Division Bracket',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-gold-ladder.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official Gold Division playoff bracket'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-maroon-ladder.jpg',
    title: '2022 Maroon Division Bracket',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/FD-maroon-ladder.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Official Maroon Division playoff bracket'
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
  // Check both ArticleLink and ContentIngestItem for duplicates
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

  console.log('🏀 FD Alumni Hub Historical Content Ingestion')
  console.log('=' .repeat(50))
  console.log(`Processing ${DISCOVERED_CONTENT.length} content items...\n`)

  for (const content of DISCOVERED_CONTENT) {
    stats.total++
    
    // Validate domain
    if (!isAllowedDomain(content.url)) {
      console.log(`❌ REJECTED (domain not allowed): ${content.url}`)
      stats.rejected++
      continue
    }

    // Get tournament for year
    const tournamentId = await getTournamentForYear(content.year)
    if (!tournamentId) {
      console.log(`⚠️ NO TOURNAMENT for year ${content.year}: ${content.title}`)
      stats.noTournament++
      continue
    }

    // Check for duplicates
    if (await isDuplicate(content.url, tournamentId)) {
      console.log(`⏭️ DUPLICATE: ${content.title}`)
      stats.duplicates++
      continue
    }

    // Initialize year stats
    if (!stats.byYear[content.year]) {
      stats.byYear[content.year] = { articles: 0, media: 0, pending: 0 }
    }

    // Initialize source stats
    if (!stats.bySource[content.source]) {
      stats.bySource[content.source] = 0
    }

    // Determine status based on confidence
    const status: IngestStatus = content.confidence === 'confirmed' ? 'approved' : 'pending'
    const kind: IngestKind = content.kind === 'media' ? 'media' : 'article'

    // Create ingest item
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
        notes: content.notes ?? 'historical-ingest-sweep'
      }
    })

    // If confirmed, also create the actual record
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
    console.log('📊 INGESTION SUMMARY')
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

    // Write stats to JSON for report generation
    const reportData = {
      timestamp: new Date().toISOString(),
      stats
    }
    
    const fs = await import('fs')
    const path = await import('path')
    const dataDir = path.join(process.cwd(), '..', '..', 'data', 'imports')
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(
      path.join(dataDir, 'historical-ingest-stats.json'),
      JSON.stringify(reportData, null, 2)
    )
    console.log('\n📄 Stats saved to data/imports/historical-ingest-stats.json')

  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

main()
