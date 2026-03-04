#!/usr/bin/env npx tsx
/**
 * Media Recovery Pass
 * 
 * Recovers broken article image URLs by extracting og:image from source articles.
 * Also normalizes redirect URLs to their final destinations.
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface RecoveryResult {
  id: string
  type: 'article' | 'redirect'
  tournamentYear: number
  originalUrl: string
  newUrl?: string
  status: 'recovered' | 'failed' | 'normalized'
  notes?: string
}

// List of broken article URLs with their source pages
const BROKEN_ARTICLES = [
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/2015-fd-alumni-tourney-video-recap/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/fd-alumni-tournament-tips-off/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/fd-alumni-tournament-day-2/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/alumni-tourney-playoffs-heating-up/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/fd-alumni-tourney-heading-into-semis/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/2004-to-play-2012-in-alumni-finals/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/one-week-done-in-alumni-hoops/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/old-rivalries-spark-alumni-hoops/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/playoff-action-underway-for-fd-hoops/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/final-four-set-in-fd-hoops/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/2004-to-face-2013-in-fd-hoops-finals/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2015/2013-wins-first-ever-fd-alumni-tourney/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/storm-cant-stop-fd-alumni-tourney/' },
  { sourceUrl: 'https://www.guamsportsnetwork.com/2014/fd-alumni-basketball-tournament-scoreboard/' },
]

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    
    const html = await response.text()
    
    // Try og:image first
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    
    if (ogMatch && ogMatch[1]) {
      return ogMatch[1].replace(/&amp;/g, '&')
    }
    
    // Try twitter:image
    const twitterMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)
    
    if (twitterMatch && twitterMatch[1]) {
      return twitterMatch[1].replace(/&amp;/g, '&')
    }
    
    // Try first large image in article body
    const imgMatch = html.match(/<img[^>]*src=["'](https?:\/\/[^"']+(?:\/wp-content\/uploads\/[^"']+))["']/i)
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1].replace(/&amp;/g, '&')
    }
    
    return null
  } catch (err) {
    console.log(`  Error fetching ${url}: ${err}`)
    return null
  }
}

async function verifyImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log('=== Media Recovery Pass ===\n')

  const results: RecoveryResult[] = []
  let recovered = 0
  let normalized = 0
  let failed = 0

  // Step 1: Recover broken article images
  console.log('Step 1: Recovering broken article images...\n')
  
  for (const item of BROKEN_ARTICLES) {
    console.log(`Processing: ${item.sourceUrl}`)
    
    // Find the article in DB
    const article = await prisma.articleLink.findFirst({
      where: { url: item.sourceUrl },
      include: { tournament: { select: { year: true } } }
    })
    
    if (!article) {
      console.log('  Article not found in database, skipping')
      continue
    }
    
    // Extract og:image
    const newImageUrl = await extractOgImage(item.sourceUrl)
    
    if (!newImageUrl) {
      console.log('  Could not extract og:image')
      results.push({
        id: article.id,
        type: 'article',
        tournamentYear: article.tournament.year,
        originalUrl: article.imageUrl || '',
        status: 'failed',
        notes: 'Could not extract og:image'
      })
      failed++
      continue
    }
    
    // Verify the new image works
    const imageValid = await verifyImage(newImageUrl)
    if (!imageValid) {
      console.log(`  Extracted image URL not valid: ${newImageUrl}`)
      results.push({
        id: article.id,
        type: 'article',
        tournamentYear: article.tournament.year,
        originalUrl: article.imageUrl || '',
        newUrl: newImageUrl,
        status: 'failed',
        notes: 'Extracted og:image URL returns 404'
      })
      failed++
      continue
    }
    
    // Update the article
    await prisma.articleLink.update({
      where: { id: article.id },
      data: { imageUrl: newImageUrl }
    })
    
    console.log(`  ✅ Recovered: ${newImageUrl.slice(0, 80)}...`)
    results.push({
      id: article.id,
      type: 'article',
      tournamentYear: article.tournament.year,
      originalUrl: article.imageUrl || '',
      newUrl: newImageUrl,
      status: 'recovered'
    })
    recovered++
  }

  // Step 2: Normalize redirect URLs (URL cleanup - remove HTML entities)
  console.log('\nStep 2: Normalizing redirect URLs...\n')
  
  // Find articles with HTML-encoded URLs
  const articlesWithEncodedUrls = await prisma.articleLink.findMany({
    where: {
      imageUrl: { contains: '&#038;' }
    },
    include: { tournament: { select: { year: true } } }
  })
  
  console.log(`Found ${articlesWithEncodedUrls.length} articles with HTML-encoded URLs`)
  
  for (const article of articlesWithEncodedUrls) {
    const newUrl = article.imageUrl?.replace(/&#038;/g, '&')
    if (newUrl && newUrl !== article.imageUrl) {
      await prisma.articleLink.update({
        where: { id: article.id },
        data: { imageUrl: newUrl }
      })
      console.log(`  ✅ Normalized URL for: ${article.title.slice(0, 50)}...`)
      results.push({
        id: article.id,
        type: 'redirect',
        tournamentYear: article.tournament.year,
        originalUrl: article.imageUrl || '',
        newUrl: newUrl,
        status: 'normalized'
      })
      normalized++
    }
  }

  // Fix malformed media URL
  const badMedia = await prisma.mediaAsset.findFirst({
    where: { imageUrl: { contains: "');" } },
    include: { tournament: { select: { year: true } } }
  })
  
  if (badMedia) {
    const cleanUrl = badMedia.imageUrl.replace("');", '')
    await prisma.mediaAsset.update({
      where: { id: badMedia.id },
      data: { imageUrl: cleanUrl }
    })
    console.log(`  ✅ Fixed malformed media URL: ${badMedia.title}`)
    results.push({
      id: badMedia.id,
      type: 'redirect',
      tournamentYear: badMedia.tournament.year,
      originalUrl: badMedia.imageUrl,
      newUrl: cleanUrl,
      status: 'normalized'
    })
    normalized++
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  console.log(`Recovered broken images: ${recovered}`)
  console.log(`Normalized redirect URLs: ${normalized}`)
  console.log(`Failed recovery: ${failed}`)

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    summary: { recovered, normalized, failed },
    results
  }

  // Ensure directory exists
  if (!fs.existsSync('../../data/imports')) {
    fs.mkdirSync('../../data/imports', { recursive: true })
  }
  
  fs.writeFileSync(
    '../../data/imports/media-recovery-report.json',
    JSON.stringify(report, null, 2)
  )
  console.log('\nReport written to: data/imports/media-recovery-report.json')

  await prisma.$disconnect()
}

main().catch(console.error)
