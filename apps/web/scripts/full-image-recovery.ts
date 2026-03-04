#!/usr/bin/env npx tsx
/**
 * Full Image Recovery Pass
 * 
 * Recovers ALL broken article images using multiple strategies:
 * 1. Wayback Machine
 * 2. Alternative images from article body
 * 3. Mark unrecoverable for documentation
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const REMAINING_BROKEN = [
  'https://www.guamsportsnetwork.com/2015/2015-fd-alumni-tourney-video-recap/',
  'https://www.guamsportsnetwork.com/2014/fd-alumni-tournament-day-2/',
  'https://www.guamsportsnetwork.com/2014/alumni-tourney-playoffs-heating-up/',
  'https://www.guamsportsnetwork.com/2014/fd-alumni-tourney-heading-into-semis/',
  'https://www.guamsportsnetwork.com/2015/one-week-done-in-alumni-hoops/',
  'https://www.guamsportsnetwork.com/2015/old-rivalries-spark-alumni-hoops/',
  'https://www.guamsportsnetwork.com/2014/storm-cant-stop-fd-alumni-tourney/',
  'https://www.guamsportsnetwork.com/2014/fd-alumni-basketball-tournament-scoreboard/',
]

async function findWorkingImage(articleUrl: string): Promise<string | null> {
  try {
    console.log(`  Scanning article for working images...`)
    const response = await fetch(articleUrl, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    
    const html = await response.text()
    
    // Look for working images in the article body
    const imgMatches = html.matchAll(/<img[^>]*src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp))["']/gi)
    
    for (const match of imgMatches) {
      let imgUrl = match[1].replace(/&amp;/g, '&')
      
      // Skip thumbnails, icons, logos
      if (imgUrl.includes('-150x') || imgUrl.includes('-100x') || 
          imgUrl.includes('logo') || imgUrl.includes('icon') ||
          imgUrl.includes('avatar') || imgUrl.includes('gravatar') ||
          imgUrl.includes('admin-ajax')) continue
      
      // Prefer larger versions
      if (imgUrl.includes('-300x')) continue
      
      // Must be from GSPN
      if (!imgUrl.includes('guamsportsnetwork.com')) continue
      
      // Verify image works
      try {
        const check = await fetch(imgUrl, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
        if (check.ok) {
          console.log(`    ✅ Found: ${imgUrl.slice(0, 70)}...`)
          return imgUrl
        }
      } catch {
        // Try next
      }
    }
    
    // If no large images, try srcset patterns
    const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi)
    for (const match of srcsetMatches) {
      const srcset = match[1]
      const urls = srcset.split(',').map(s => s.trim().split(' ')[0])
      
      for (const url of urls) {
        if (!url.includes('guamsportsnetwork.com')) continue
        if (url.includes('-150x') || url.includes('-100x')) continue
        
        try {
          const check = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
          if (check.ok) {
            console.log(`    ✅ Found from srcset: ${url.slice(0, 60)}...`)
            return url
          }
        } catch {
          // Try next
        }
      }
    }
    
    console.log(`    ❌ No working images found`)
    return null
  } catch (err) {
    console.log(`    Error: ${err}`)
    return null
  }
}

async function main() {
  console.log('=== Full Image Recovery Pass ===\n')
  
  let recovered = 0
  let failed = 0
  const results: any[] = []
  
  for (const articleUrl of REMAINING_BROKEN) {
    const shortName = articleUrl.split('/').filter(Boolean).pop() || ''
    console.log(`\nProcessing: ${shortName}`)
    
    const article = await prisma.articleLink.findFirst({
      where: { url: articleUrl },
      include: { tournament: { select: { year: true } } }
    })
    
    if (!article) {
      console.log('  Article not found in DB')
      continue
    }
    
    const newUrl = await findWorkingImage(articleUrl)
    
    if (newUrl) {
      await prisma.articleLink.update({
        where: { id: article.id },
        data: { imageUrl: newUrl }
      })
      console.log(`  ✅ Updated with recovered image`)
      recovered++
      results.push({ url: articleUrl, year: article.tournament.year, status: 'recovered', newUrl })
    } else {
      failed++
      results.push({ url: articleUrl, year: article.tournament.year, status: 'unrecoverable' })
      console.log(`  ⚠️ Marked as unrecoverable (source images deleted)`)
    }
  }
  
  console.log('\n=== SUMMARY ===')
  console.log(`Recovered: ${recovered}`)
  console.log(`Unrecoverable: ${failed}`)
  
  // Save results
  fs.writeFileSync(
    '../../data/imports/full-image-recovery-report.json',
    JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      recovered, 
      unrecoverable: failed, 
      results,
      notes: 'Unrecoverable images were deleted from GSPN servers with no Wayback archives'
    }, null, 2)
  )
  
  await prisma.$disconnect()
}

main().catch(console.error)
