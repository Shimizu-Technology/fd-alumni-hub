/**
 * Historical Quality Pass
 * 
 * Performs quality cleanup on historical content:
 * 1. Dedupe content/media entries (by URL and normalized title)
 * 2. Normalize titles/source naming
 * 3. Ensure attribution consistency
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Source normalization mapping
const SOURCE_NORMALIZATION: Record<string, string> = {
  'guamsportsnetwork.com': 'GSPN',
  'gspn': 'GSPN',
  'GSPN': 'GSPN',
  'Clutch': 'Clutch',
  'clutch': 'Clutch',
  'clutchguam.com': 'Clutch',
  'guampdn.com': 'GuamPDN',
  'GuamPDN': 'GuamPDN',
  'guampdn': 'GuamPDN',
}

function normalizeSource(source: string): string {
  return SOURCE_NORMALIZATION[source] ?? source
}

function normalizeTitle(title: string): string {
  // Remove extra whitespace
  let normalized = title.replace(/\s+/g, ' ').trim()
  
  // Capitalize first letter of each word (title case)
  // But preserve acronyms like GSPN, FD, etc.
  normalized = normalized.replace(/\b([a-z])/g, (_, char) => char.toUpperCase())
  
  return normalized
}

interface QualityResult {
  articlesDeduped: number
  articlesNormalized: number
  mediaDeduped: number
  mediaNormalized: number
  ingestNormalized: number
  duplicatesRemoved: { type: string; title: string; url: string }[]
}

async function main(): Promise<QualityResult> {
  const result: QualityResult = {
    articlesDeduped: 0,
    articlesNormalized: 0,
    mediaDeduped: 0,
    mediaNormalized: 0,
    ingestNormalized: 0,
    duplicatesRemoved: [],
  }

  console.log('\n🧹 Historical Quality Pass')
  console.log('━'.repeat(60))

  // ========== ARTICLES ==========
  console.log('\n📰 Processing ArticleLinks...')
  
  // Find duplicate articles by URL
  const allArticles = await prisma.articleLink.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const articlesByUrl = new Map<string, typeof allArticles>()
  for (const article of allArticles) {
    const key = article.url.toLowerCase().trim()
    if (!articlesByUrl.has(key)) {
      articlesByUrl.set(key, [])
    }
    articlesByUrl.get(key)!.push(article)
  }

  // Remove duplicates (keep oldest)
  for (const [url, articles] of articlesByUrl) {
    if (articles.length > 1) {
      const [keep, ...remove] = articles
      for (const dup of remove) {
        await prisma.articleLink.delete({ where: { id: dup.id } })
        result.articlesDeduped++
        result.duplicatesRemoved.push({
          type: 'article',
          title: dup.title,
          url: dup.url,
        })
      }
      console.log(`   Deduped article: ${keep.title} (removed ${remove.length} duplicates)`)
    }
  }

  // Normalize remaining articles
  const remainingArticles = await prisma.articleLink.findMany()
  for (const article of remainingArticles) {
    const normalizedSource = normalizeSource(article.source)
    const normalizedTitle = normalizeTitle(article.title)
    
    if (normalizedSource !== article.source || normalizedTitle !== article.title) {
      await prisma.articleLink.update({
        where: { id: article.id },
        data: {
          source: normalizedSource,
          title: normalizedTitle,
        },
      })
      result.articlesNormalized++
    }
  }

  console.log(`   Normalized ${result.articlesNormalized} articles`)

  // ========== MEDIA ==========
  console.log('\n🖼️  Processing MediaAssets...')
  
  // Find duplicate media by imageUrl
  const allMedia = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const mediaByUrl = new Map<string, typeof allMedia>()
  for (const media of allMedia) {
    const key = media.imageUrl.toLowerCase().trim()
    if (!mediaByUrl.has(key)) {
      mediaByUrl.set(key, [])
    }
    mediaByUrl.get(key)!.push(media)
  }

  // Remove duplicates (keep oldest)
  for (const [url, mediaList] of mediaByUrl) {
    if (mediaList.length > 1) {
      const [keep, ...remove] = mediaList
      for (const dup of remove) {
        await prisma.mediaAsset.delete({ where: { id: dup.id } })
        result.mediaDeduped++
        result.duplicatesRemoved.push({
          type: 'media',
          title: dup.title,
          url: dup.imageUrl,
        })
      }
      console.log(`   Deduped media: ${keep.title} (removed ${remove.length} duplicates)`)
    }
  }

  // Normalize remaining media
  const remainingMedia = await prisma.mediaAsset.findMany()
  for (const media of remainingMedia) {
    const normalizedSource = normalizeSource(media.source)
    const normalizedTitle = normalizeTitle(media.title)
    
    if (normalizedSource !== media.source || normalizedTitle !== media.title) {
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: {
          source: normalizedSource,
          title: normalizedTitle,
        },
      })
      result.mediaNormalized++
    }
  }

  console.log(`   Normalized ${result.mediaNormalized} media assets`)

  // ========== INGEST ITEMS ==========
  console.log('\n📥 Processing ContentIngestItems...')
  
  const allIngest = await prisma.contentIngestItem.findMany()
  for (const item of allIngest) {
    const normalizedSource = normalizeSource(item.source)
    const normalizedTitle = normalizeTitle(item.title)
    
    if (normalizedSource !== item.source || normalizedTitle !== item.title) {
      await prisma.contentIngestItem.update({
        where: { id: item.id },
        data: {
          source: normalizedSource,
          title: normalizedTitle,
        },
      })
      result.ingestNormalized++
    }
  }

  console.log(`   Normalized ${result.ingestNormalized} ingest items`)

  return result
}

async function printSummary(result: QualityResult): Promise<void> {
  console.log('\n' + '━'.repeat(60))
  console.log('📋 QUALITY PASS SUMMARY')
  console.log('━'.repeat(60))
  console.log(`   📰 Articles: ${result.articlesDeduped} deduped, ${result.articlesNormalized} normalized`)
  console.log(`   🖼️  Media: ${result.mediaDeduped} deduped, ${result.mediaNormalized} normalized`)
  console.log(`   📥 Ingest: ${result.ingestNormalized} normalized`)
  console.log(`   🗑️  Total duplicates removed: ${result.duplicatesRemoved.length}`)

  if (result.duplicatesRemoved.length > 0) {
    console.log('\n   REMOVED DUPLICATES:')
    for (const dup of result.duplicatesRemoved.slice(0, 10)) {
      console.log(`   - [${dup.type}] ${dup.title}`)
    }
    if (result.duplicatesRemoved.length > 10) {
      console.log(`   ... and ${result.duplicatesRemoved.length - 10} more`)
    }
  }

  // Final counts
  const articleCount = await prisma.articleLink.count()
  const mediaCount = await prisma.mediaAsset.count()
  console.log(`\n   📊 Final counts: ${articleCount} articles, ${mediaCount} media assets`)
}

main()
  .then(printSummary)
  .catch(console.error)
  .finally(() => prisma.$disconnect())
