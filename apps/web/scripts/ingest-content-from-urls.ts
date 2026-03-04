import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const allowlist = [
  'guamsportsnetwork.com',
  'clutchguam.com',
  'guampdn.com',
]

function isAllowed(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return allowlist.some((d) => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

async function main() {
  const tournamentId = process.argv[2]
  const urls = process.argv.slice(3)
  if (!tournamentId || urls.length === 0) {
    console.log('Usage: tsx scripts/ingest-content-from-urls.ts <tournamentId> <url1> <url2> ...')
    process.exit(1)
  }

  for (const url of urls) {
    if (!isAllowed(url)) {
      console.log(`skip (not allowlisted): ${url}`)
      continue
    }

    const title = url
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .split('/')
      .pop()
      ?.replace(/[-_]/g, ' ') || 'Imported content'

    await db.contentIngestItem.create({
      data: {
        tournamentId,
        kind: 'article',
        status: 'pending',
        source: new URL(url).hostname.replace(/^www\./, ''),
        title,
        url,
        confidence: 'review-required',
        notes: 'seeded-by-script; requires manual verification',
      },
    })

    console.log(`queued: ${url}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
