#!/usr/bin/env npx tsx
/**
 * Wayback Machine Image Recovery
 * 
 * Attempts to recover broken images from web.archive.org snapshots.
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface WaybackResult {
  url: string
  archived_snapshots: {
    closest?: {
      status: string
      available: boolean
      url: string
      timestamp: string
    }
  }
}

// URLs to recover with their article URLs
const BROKEN_IMAGES = [
  // 2015 articles - most valuable since we have photo galleries
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2015/2013-wins-first-ever-fd-alumni-tourney/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2015/06/fd-champs-10.jpg'
  },
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2015/2004-to-face-2013-in-fd-hoops-finals/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2015/06/Alumni-41.jpg'
  },
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2015/final-four-set-in-fd-hoops/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2015/06/BBall-112.jpg'
  },
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2015/playoff-action-underway-for-fd-hoops/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2015/06/BBall-13.jpg'
  },
  // 2014 key articles
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2014/fd-alumni-tournament-tips-off/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_4790.jpg'
  },
  { 
    articleUrl: 'https://www.guamsportsnetwork.com/2014/2004-to-play-2012-in-alumni-finals/',
    brokenImageUrl: 'https://i0.wp.com/www.guamsportsnetwork.com/wp-content/uploads/2014/07/IMG_1968.jpg'
  },
]

async function checkWayback(url: string): Promise<string | null> {
  try {
    // Clean URL for Wayback API
    const cleanUrl = url.replace('https://i0.wp.com/', '')
    const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(cleanUrl)}`
    
    console.log(`  Checking Wayback for: ${cleanUrl.slice(0, 60)}...`)
    
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    
    const data: WaybackResult = await response.json()
    
    if (data.archived_snapshots?.closest?.available) {
      const waybackUrl = data.archived_snapshots.closest.url
      // For images, we want the raw version
      const rawUrl = waybackUrl.replace('/web/', '/web/im_/')
      
      // Verify the wayback image works
      const imgCheck = await fetch(rawUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      if (imgCheck.ok) {
        console.log(`    ✅ Found archived version from ${data.archived_snapshots.closest.timestamp}`)
        return rawUrl
      }
    }
    
    console.log(`    ❌ No archive found`)
    return null
  } catch (err) {
    console.log(`    Error: ${err}`)
    return null
  }
}

async function findAlternativeImage(articleUrl: string): Promise<string | null> {
  // Try to find an alternative image from the article body
  try {
    console.log(`  Trying to find alternative image from article...`)
    const response = await fetch(articleUrl, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    
    const html = await response.text()
    
    // Look for working images in the article body
    const imgMatches = html.matchAll(/<img[^>]*src=["'](https?:\/\/[^"']+(?:\/wp-content\/uploads\/[^"']+\.(?:jpg|jpeg|png)))["']/gi)
    
    for (const match of imgMatches) {
      let imgUrl = match[1].replace(/&amp;/g, '&')
      
      // Skip thumbnails and small versions
      if (imgUrl.includes('-150x') || imgUrl.includes('-300x') || imgUrl.includes('-100x')) continue
      
      // Verify image works
      const check = await fetch(imgUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      if (check.ok) {
        console.log(`    ✅ Found alternative: ${imgUrl.slice(0, 60)}...`)
        return imgUrl
      }
    }
    
    console.log(`    ❌ No working alternative found`)
    return null
  } catch (err) {
    console.log(`    Error: ${err}`)
    return null
  }
}

async function main() {
  console.log('=== Wayback Machine Image Recovery ===\n')
  
  let recovered = 0
  let failed = 0
  const results: any[] = []
  
  for (const item of BROKEN_IMAGES) {
    console.log(`\nProcessing: ${item.articleUrl.split('/').pop()}`)
    
    // First try Wayback Machine
    const waybackUrl = await checkWayback(item.brokenImageUrl)
    
    if (waybackUrl) {
      // Update the article
      const article = await prisma.articleLink.findFirst({
        where: { url: item.articleUrl }
      })
      
      if (article) {
        await prisma.articleLink.update({
          where: { id: article.id },
          data: { imageUrl: waybackUrl }
        })
        console.log(`  Updated article with Wayback URL`)
        recovered++
        results.push({ url: item.articleUrl, status: 'recovered_wayback', newUrl: waybackUrl })
        continue
      }
    }
    
    // If Wayback fails, try finding alternative from article body
    const altUrl = await findAlternativeImage(item.articleUrl)
    
    if (altUrl) {
      const article = await prisma.articleLink.findFirst({
        where: { url: item.articleUrl }
      })
      
      if (article) {
        await prisma.articleLink.update({
          where: { id: article.id },
          data: { imageUrl: altUrl }
        })
        console.log(`  Updated article with alternative image`)
        recovered++
        results.push({ url: item.articleUrl, status: 'recovered_alt', newUrl: altUrl })
        continue
      }
    }
    
    failed++
    results.push({ url: item.articleUrl, status: 'failed' })
  }
  
  console.log('\n=== SUMMARY ===')
  console.log(`Recovered: ${recovered}`)
  console.log(`Failed: ${failed}`)
  
  // Save results
  fs.writeFileSync(
    '../../data/imports/wayback-recovery-report.json',
    JSON.stringify({ timestamp: new Date().toISOString(), recovered, failed, results }, null, 2)
  )
  
  await prisma.$disconnect()
}

main().catch(console.error)
