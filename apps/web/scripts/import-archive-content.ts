#!/usr/bin/env npx tsx
/**
 * Import static public-archive content into the database.
 *
 * This lets local/prod operators materialize the researched article/media archive
 * after deploy without depending on runtime static fallbacks.
 */

import { PrismaClient } from '@prisma/client'
import {
  ARCHIVE_ARTICLES,
  STATIC_TOURNAMENT_YEARS,
  archiveMediaForYear,
  championForYear,
} from '@/lib/historical-archive'
import { guamDateStringToDate, guamLocalDateTimeToUtc } from '@/lib/datetime'

const prisma = new PrismaClient()
const TOURNAMENT_NAME = 'FD Alumni Basketball Tournament'

function tournamentDates(year: number) {
  return {
    startDate: guamLocalDateTimeToUtc(year, 6, 1, 0, 0, 0, 0),
    endDate: guamLocalDateTimeToUtc(year, 8, 1, 23, 59, 59, 999),
  }
}

async function ensureTournament(year: number) {
  const champion = championForYear(year)
  const { startDate, endDate } = tournamentDates(year)

  return prisma.tournament.upsert({
    where: { year_name: { year, name: TOURNAMENT_NAME } },
    update: {
      status: champion?.status === 'cancelled' ? 'completed' : undefined,
    },
    create: {
      year,
      name: TOURNAMENT_NAME,
      status: champion?.status === 'cancelled' ? 'completed' : 'completed',
      startDate,
      endDate,
    },
  })
}

async function upsertArticle(tournamentId: string, article: typeof ARCHIVE_ARTICLES[number]) {
  const existing = await prisma.articleLink.findFirst({ where: { tournamentId, url: article.url } })
  const data = {
    tournamentId,
    title: article.title,
    source: article.source,
    url: article.url,
    imageUrl: article.imageUrl,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt ? guamDateStringToDate(article.publishedAt) : null,
  }

  if (existing) {
    await prisma.articleLink.update({ where: { id: existing.id }, data })
    return 'updated'
  }

  await prisma.articleLink.create({ data })
  return 'created'
}

async function upsertMedia(tournamentId: string, media: ReturnType<typeof archiveMediaForYear>[number]) {
  const existing = await prisma.mediaAsset.findFirst({ where: { tournamentId, imageUrl: media.imageUrl } })
  const data = {
    tournamentId,
    title: media.title,
    source: media.source,
    imageUrl: media.imageUrl,
    articleUrl: media.articleUrl ?? null,
    caption: media.caption ?? null,
    tags: media.tags ?? null,
    takenAt: media.takenAt ? guamDateStringToDate(media.takenAt) : null,
  }

  if (existing) {
    await prisma.mediaAsset.update({ where: { id: existing.id }, data })
    return 'updated'
  }

  await prisma.mediaAsset.create({ data })
  return 'created'
}

async function main() {
  let articleCreated = 0
  let articleUpdated = 0
  let mediaCreated = 0
  let mediaUpdated = 0

  for (const year of STATIC_TOURNAMENT_YEARS) {
    const tournament = await ensureTournament(year)
    for (const article of ARCHIVE_ARTICLES.filter((item) => item.year === year)) {
      const result = await upsertArticle(tournament.id, article)
      if (result === 'created') articleCreated++
      else articleUpdated++
    }

    for (const media of archiveMediaForYear(year)) {
      if (!media.imageUrl) continue
      const result = await upsertMedia(tournament.id, media)
      if (result === 'created') mediaCreated++
      else mediaUpdated++
    }
  }

  console.log({ articleCreated, articleUpdated, mediaCreated, mediaUpdated })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
