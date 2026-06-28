import { PrismaClient } from '@prisma/client'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL
if (!sourceUrl) {
  console.error('SOURCE_DATABASE_URL or DATABASE_URL is required for export')
  process.exit(1)
}

process.env.DATABASE_URL = sourceUrl

const prisma = new PrismaClient()
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

type ExportPayload = {
  format: 'fd-alumni-hub-next-prisma-export'
  version: 1
  exportedAt: string
  source: {
    app: 'apps/web'
    databaseProvider: 'postgresql'
  }
  counts: Record<string, number>
  records: Record<string, unknown[]>
}

function argValue(name: string) {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function defaultOutPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  return `tmp/fd-migration/next-prisma-export-${stamp}.json`
}

function outputPath() {
  const requested = argValue('--out') || process.env.FD_EXPORT_PATH
  return requested ? resolve(process.cwd(), requested) : resolve(repoRoot, defaultOutPath())
}

async function main() {
  const outPath = outputPath()

  const [
    tournaments,
    teams,
    games,
    standings,
    articleLinks,
    mediaAssets,
    sponsors,
    contentIngestItems,
    adminWhitelists,
    appUsers,
  ] = await Promise.all([
    prisma.tournament.findMany({ orderBy: [ { year: 'asc' }, { name: 'asc' }, { id: 'asc' } ] }),
    prisma.team.findMany({ orderBy: [ { tournamentId: 'asc' }, { displayName: 'asc' }, { id: 'asc' } ] }),
    prisma.game.findMany({ orderBy: [ { tournamentId: 'asc' }, { startTime: 'asc' }, { id: 'asc' } ] }),
    prisma.standing.findMany({ orderBy: [ { tournamentId: 'asc' }, { teamId: 'asc' }, { id: 'asc' } ] }),
    prisma.articleLink.findMany({ orderBy: [ { tournamentId: 'asc' }, { publishedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' } ] }),
    prisma.mediaAsset.findMany({ orderBy: [ { tournamentId: 'asc' }, { takenAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' } ] }),
    prisma.sponsor.findMany({ orderBy: [ { tournamentId: 'asc' }, { position: 'asc' }, { name: 'asc' }, { id: 'asc' } ] }),
    prisma.contentIngestItem.findMany({ orderBy: [ { tournamentId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' } ] }),
    prisma.adminWhitelist.findMany({ orderBy: [ { email: 'asc' }, { id: 'asc' } ] }),
    prisma.appUser.findMany({ orderBy: [ { email: 'asc' }, { id: 'asc' } ] }),
  ])

  const records = {
    tournaments,
    teams,
    games,
    standings,
    articleLinks,
    mediaAssets,
    sponsors,
    contentIngestItems,
    adminWhitelists,
    appUsers,
  }

  const payload: ExportPayload = {
    format: 'fd-alumni-hub-next-prisma-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      app: 'apps/web',
      databaseProvider: 'postgresql',
    },
    counts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length])),
    records,
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`)

  console.log(`Exported Next/Prisma snapshot to ${outPath}`)
  console.table(payload.counts)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
