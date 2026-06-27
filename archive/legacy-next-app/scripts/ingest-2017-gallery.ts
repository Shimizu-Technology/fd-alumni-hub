#!/usr/bin/env npx tsx
/**
 * Ingest 2017 Jersey Retirement Photo Gallery
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GALLERY_IMAGES = [
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0353.jpg', title: 'Jersey Retirement Ceremony - Ricardo Eusebio #33' },
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0363.jpg', title: 'Jersey Retirement Ceremony - Eduardo Calvo #10' },
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0376.jpg', title: 'Jersey Retirement Ceremony - Stephen Baza #30' },
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0387.jpg', title: 'Jersey Retirement Ceremony - Chris Fernandez #21' },
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0397.jpg', title: 'Jersey Retirement Ceremony - Vince Estella #12' },
  { url: 'https://www.guamsportsnetwork.com/wp-content/uploads/2017/02/IMG_0412.jpg', title: 'Jersey Retirement Ceremony - Willie Stinnett #23' },
]

const ARTICLE_URL = 'https://www.guamsportsnetwork.com/2017/friars-retire-six-basketball-jereseys/'

async function main() {
  console.log('=== Ingesting 2017 Jersey Retirement Gallery ===\n')

  // Find 2017 tournament
  const tournament = await prisma.tournament.findFirst({
    where: { year: 2017 }
  })

  if (!tournament) {
    console.error('2017 tournament not found')
    return
  }

  let added = 0
  let skipped = 0

  for (const img of GALLERY_IMAGES) {
    // Check if already exists
    const existing = await prisma.mediaAsset.findFirst({
      where: { imageUrl: img.url, tournamentId: tournament.id }
    })

    if (existing) {
      console.log(`Skipping (exists): ${img.title}`)
      skipped++
      continue
    }

    // Verify image works
    try {
      const check = await fetch(img.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      if (!check.ok) {
        console.log(`Skipping (404): ${img.title}`)
        skipped++
        continue
      }
    } catch {
      console.log(`Skipping (error): ${img.title}`)
      skipped++
      continue
    }

    // Add media asset
    await prisma.mediaAsset.create({
      data: {
        tournamentId: tournament.id,
        source: 'GSPN',
        title: img.title,
        imageUrl: img.url,
        articleUrl: ARTICLE_URL,
        caption: 'First-ever FD basketball jersey retirement ceremony',
        tags: 'jersey-retirement,ceremony,legends,history',
        takenAt: new Date('2017-02-12')
      }
    })

    console.log(`✅ Added: ${img.title}`)
    added++
  }

  console.log(`\n=== SUMMARY ===`)
  console.log(`Added: ${added}`)
  console.log(`Skipped: ${skipped}`)

  // Also add ingest items for tracking
  for (const img of GALLERY_IMAGES) {
    const existing = await prisma.contentIngestItem.findFirst({
      where: { url: img.url }
    })
    
    if (!existing) {
      await prisma.contentIngestItem.create({
        data: {
          tournamentId: tournament.id,
          kind: 'media',
          status: 'approved',
          source: 'GSPN',
          title: img.title,
          url: img.url,
          imageUrl: img.url,
          confidence: 'high',
          notes: 'Extracted from jersey retirement article gallery',
          importedToId: 'media-asset'
        }
      })
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
