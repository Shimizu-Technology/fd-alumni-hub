#!/usr/bin/env npx tsx
/**
 * Historical Content Acquisition - Pass 2
 * Additional content discovered from GSPN
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

// Additional content discovered in Pass 2
const DISCOVERED_CONTENT: ContentCandidate[] = [
  // 2022 - Missing championship & semifinal articles
  {
    url: 'https://www.guamsportsnetwork.com/2022/02-04-reclaims-fd-alumni-hoops-reign/',
    title: "'02/'04 Reclaims FD Alumni Hoops Reign",
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-07-15',
    excerpt: 'Class of 2002/2004 won their fifth overall championship after defeating the younger Class of 2020 62-52. Shaun Perez led with 25 points.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2022 Championship game recap - 02/04 wins 5th title'
  },
  {
    url: 'https://www.guamsportsnetwork.com/2022/2020-blows-out-06-in-fd-semifinals/',
    title: "2020 Blows Out '06 in FD Semifinals",
    source: 'guamsportsnetwork.com',
    year: 2022,
    publishedAt: '2022-07-14',
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/WhatsApp-Image-2022-07-13-at-3.22.33-PM.jpeg',
    excerpt: 'Class of 2020 handed 8-time champion Class of 2006 a lopsided 57-26 loss. 02/04 beat 2016 54-43 in other semis.',
    confidence: 'confirmed',
    kind: 'article',
    notes: '2022 Semifinals coverage - 2006 dynasty ends'
  },

  // 2023 - Additional coverage needed
  {
    url: 'https://www.guamsportsnetwork.com/2023/fd-alumni-2023-championship/',
    title: '2023 FD Alumni Championship',
    source: 'guamsportsnetwork.com',
    year: 2023,
    confidence: 'review-required',
    kind: 'article',
    notes: '2023 Championship article - needs URL verification'
  },

  // Additional media from 2022
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/WhatsApp-Image-2022-07-13-at-3.22.33-PM.jpeg',
    title: '2022 FD Semifinals Action',
    source: 'guamsportsnetwork.com',
    year: 2022,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2022/07/WhatsApp-Image-2022-07-13-at-3.22.33-PM.jpeg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Semifinals game action photo'
  },

  // 2021 - Additional photos from championship
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-1-2.jpg',
    title: '2006 vs 02/04 Championship - 2021',
    source: 'guamsportsnetwork.com',
    year: 2021,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-1-2.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship game action'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-22.jpg',
    title: 'John Cramer Gets Crowd Going - 2021',
    source: 'guamsportsnetwork.com',
    year: 2021,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2021/07/FDalumnitournamentchampionship2021-22.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Championship game crowd engagement'
  },

  // 2019 - Additional photos
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-1.jpg',
    title: '2006 vs 2016 Game Action 1 - 2019',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Opening night 2019 game action'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-5.jpg',
    title: '2006 vs 2016 Game Action 2 - 2019',
    source: 'guamsportsnetwork.com',
    year: 2019,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2019/06/06-V-16-ALUMNI-TOURNEY-2019-5.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Opening night 2019 game action'
  },

  // 2015 - Additional photos from championship
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-1.jpg',
    title: 'FD Alumni Tribute to Jay Juice Cruz - 2015',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Moment of silence for Jay Cruz before championship'
  },
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-4.jpg',
    title: 'John Baza Running Jumper - 2015 Finals',
    source: 'guamsportsnetwork.com',
    year: 2015,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-4.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'John Baza game action - championship game'
  },

  // 2018 - Additional photo
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-1.jpg',
    title: '2018 Championship Game Photo',
    source: 'guamsportsnetwork.com',
    year: 2018,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2018/07/2018-FD-Alumni-Tournament-Finals-1.jpg',
    confidence: 'confirmed',
    kind: 'media',
    notes: '2018 Finals - 02/04 repeats'
  },

  // 2025 - Additional photos
  {
    url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2025/06/WhatsApp-Image-2025-06-27-at-11.15.25-PM-1024x683.jpeg',
    title: '2025 Opening Night - Class of 2025 Upset',
    source: 'guamsportsnetwork.com',
    year: 2025,
    imageUrl: 'https://www.guamsportsnetwork.com/wp-content/uploads/2025/06/WhatsApp-Image-2025-06-27-at-11.15.25-PM-1024x683.jpeg',
    confidence: 'confirmed',
    kind: 'media',
    notes: 'Class of 2025 defeats defending champs 16/17'
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

  console.log('🏀 FD Alumni Hub Historical Content Ingestion - Pass 2')
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
        notes: content.notes ?? 'historical-ingest-pass2'
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
    console.log('📊 INGESTION SUMMARY (Pass 2)')
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

  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    throw error
  } finally {
    await db.$disconnect()
  }
}

main()
