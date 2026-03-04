#!/usr/bin/env npx tsx
/**
 * Media Health Check Script
 * 
 * Analyzes media assets and article images for:
 * - Broken/404 URLs
 * - Fallback/placeholder patterns
 * - URL structure anomalies
 * - Recovery opportunities
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface MediaHealthResult {
  id: string
  type: 'media' | 'article'
  tournamentYear: number
  url: string
  status: 'ok' | 'broken' | 'fallback' | 'redirect'
  statusCode?: number
  finalUrl?: string
  recoveryPotential?: string
}

const FALLBACK_PATTERNS = [
  /placeholder/i,
  /default/i,
  /fallback/i,
  /no-image/i,
  /missing/i,
  /blank\.png/i,
  /blank\.jpg/i,
  /\d+x\d+\.png/i, // Size-only placeholder images like 300x200.png
]

async function checkUrl(url: string): Promise<{ status: number; finalUrl: string; ok: boolean }> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    })
    return {
      status: response.status,
      finalUrl: response.url,
      ok: response.ok
    }
  } catch (err) {
    return { status: 0, finalUrl: url, ok: false }
  }
}

function isFallbackUrl(url: string): boolean {
  return FALLBACK_PATTERNS.some(p => p.test(url))
}

async function main() {
  console.log('=== Media Health Check ===\n')

  // Get all media assets
  const mediaAssets = await prisma.mediaAsset.findMany({
    include: { tournament: { select: { year: true } } }
  })
  console.log(`Found ${mediaAssets.length} media assets`)

  // Get all article links with images
  const articles = await prisma.articleLink.findMany({
    where: { imageUrl: { not: null } },
    include: { tournament: { select: { year: true } } }
  })
  console.log(`Found ${articles.length} articles with images\n`)

  const results: MediaHealthResult[] = []
  const brokenUrls: MediaHealthResult[] = []
  const fallbackUrls: MediaHealthResult[] = []
  const redirectUrls: MediaHealthResult[] = []

  // Check media assets
  console.log('Checking media asset URLs...')
  for (const asset of mediaAssets) {
    const url = asset.imageUrl
    
    // Check for fallback patterns first
    if (isFallbackUrl(url)) {
      const result: MediaHealthResult = {
        id: asset.id,
        type: 'media',
        tournamentYear: asset.tournament.year,
        url,
        status: 'fallback',
        recoveryPotential: asset.articleUrl ? `Try extracting from: ${asset.articleUrl}` : undefined
      }
      fallbackUrls.push(result)
      results.push(result)
      continue
    }

    // Check URL health
    const check = await checkUrl(url)
    const result: MediaHealthResult = {
      id: asset.id,
      type: 'media',
      tournamentYear: asset.tournament.year,
      url,
      status: check.ok ? (check.finalUrl !== url ? 'redirect' : 'ok') : 'broken',
      statusCode: check.status,
      finalUrl: check.finalUrl !== url ? check.finalUrl : undefined,
      recoveryPotential: !check.ok && asset.articleUrl ? `Try extracting from: ${asset.articleUrl}` : undefined
    }
    
    if (!check.ok) brokenUrls.push(result)
    else if (check.finalUrl !== url) redirectUrls.push(result)
    results.push(result)
  }

  // Check article images
  console.log('Checking article image URLs...')
  for (const article of articles) {
    const url = article.imageUrl!
    
    if (isFallbackUrl(url)) {
      const result: MediaHealthResult = {
        id: article.id,
        type: 'article',
        tournamentYear: article.tournament.year,
        url,
        status: 'fallback',
        recoveryPotential: `Try extracting og:image from: ${article.url}`
      }
      fallbackUrls.push(result)
      results.push(result)
      continue
    }

    const check = await checkUrl(url)
    const result: MediaHealthResult = {
      id: article.id,
      type: 'article',
      tournamentYear: article.tournament.year,
      url,
      status: check.ok ? (check.finalUrl !== url ? 'redirect' : 'ok') : 'broken',
      statusCode: check.status,
      finalUrl: check.finalUrl !== url ? check.finalUrl : undefined,
      recoveryPotential: !check.ok ? `Try extracting og:image from: ${article.url}` : undefined
    }
    
    if (!check.ok) brokenUrls.push(result)
    else if (check.finalUrl !== url) redirectUrls.push(result)
    results.push(result)
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  console.log(`Total checked: ${results.length}`)
  console.log(`OK: ${results.filter(r => r.status === 'ok').length}`)
  console.log(`Broken: ${brokenUrls.length}`)
  console.log(`Fallback/Placeholder: ${fallbackUrls.length}`)
  console.log(`Redirected: ${redirectUrls.length}`)

  if (brokenUrls.length > 0) {
    console.log('\n=== BROKEN URLS (Recovery Candidates) ===')
    for (const r of brokenUrls) {
      console.log(`[${r.type}] ${r.tournamentYear} - ${r.url}`)
      console.log(`  Status: ${r.statusCode}`)
      if (r.recoveryPotential) console.log(`  Recovery: ${r.recoveryPotential}`)
    }
  }

  if (fallbackUrls.length > 0) {
    console.log('\n=== FALLBACK/PLACEHOLDER URLS (Recovery Candidates) ===')
    for (const r of fallbackUrls) {
      console.log(`[${r.type}] ${r.tournamentYear} - ${r.url}`)
      if (r.recoveryPotential) console.log(`  Recovery: ${r.recoveryPotential}`)
    }
  }

  if (redirectUrls.length > 0) {
    console.log('\n=== REDIRECTED URLS (Can update to final URL) ===')
    for (const r of redirectUrls) {
      console.log(`[${r.type}] ${r.tournamentYear}`)
      console.log(`  From: ${r.url}`)
      console.log(`  To: ${r.finalUrl}`)
    }
  }

  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      ok: results.filter(r => r.status === 'ok').length,
      broken: brokenUrls.length,
      fallback: fallbackUrls.length,
      redirected: redirectUrls.length
    },
    brokenUrls,
    fallbackUrls,
    redirectUrls
  }

  const fs = await import('fs')
  fs.writeFileSync(
    'data/imports/media-health-report.json',
    JSON.stringify(report, null, 2)
  )
  console.log('\nDetailed report written to: data/imports/media-health-report.json')

  await prisma.$disconnect()
}

main().catch(console.error)
