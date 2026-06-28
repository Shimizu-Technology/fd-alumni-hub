#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function usage() {
  console.error(`Usage: node scripts/filter-next-prisma-snapshot.mjs --in <snapshot.json> --out <filtered.json> [--max-year 2025] [--min-year 2000] [--years 2024,2025] [--include-admin] [--allow-missing-relations]

Creates a relationship-safe Next/Prisma snapshot subset for Rails import.
Defaults are intentionally production-safe for this repo: historical years only (--max-year 2025) and no old admin/user records.

By default, the script exits if selected games or standings reference teams that are not in the filtered snapshot. Use --allow-missing-relations only when intentionally producing a partial snapshot.`)
}

function optionValue(name) {
  const prefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function requiredOption(name) {
  const value = optionValue(name)
  if (!value) {
    usage()
    process.exit(1)
  }
  return value
}

function parseIntegerOption(name, fallback = null) {
  const raw = optionValue(name)
  if (raw === undefined) return fallback

  if (!/^\d+$/.test(raw.trim())) {
    console.error(`${name} must be an integer`)
    process.exit(1)
  }

  return Number(raw)
}

function parseYearList() {
  const raw = optionValue('--years')
  if (raw === undefined) return undefined

  const values = raw.split(',').map((value) => value.trim())
  const invalid = values.filter((value) => !/^\d{4}$/.test(value))

  if (invalid.length > 0) {
    console.error(`--years contains non-integer year values: ${invalid.join(', ')}`)
    process.exit(1)
  }

  return values.map(Number)
}

function recordYear(record) {
  const year = Number(record?.year)
  return Number.isInteger(year) ? year : null
}

function byId(records) {
  return new Set(records.map((record) => record.id).filter(Boolean))
}

function filterByTournament(records, tournamentIds) {
  return records.filter((record) => tournamentIds.has(record.tournamentId))
}

function sortCounts(records) {
  return Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.length]))
}

function describeRecords(records, formatter) {
  return records.slice(0, 10).map(formatter).join('\n')
}

function failOnMissingRelations({ missingTeamGames, missingStandingTeams }) {
  const messages = []

  if (missingTeamGames.length > 0) {
    messages.push(`Selected games reference missing teams (${missingTeamGames.length}):`)
    messages.push(describeRecords(missingTeamGames, (game) => `  - game ${game.id} homeTeamId=${game.homeTeamId} awayTeamId=${game.awayTeamId}`))
  }

  if (missingStandingTeams.length > 0) {
    messages.push(`Selected standings reference missing teams (${missingStandingTeams.length}):`)
    messages.push(describeRecords(missingStandingTeams, (standing) => `  - standing ${standing.id} teamId=${standing.teamId}`))
  }

  if (messages.length === 0) return

  console.error(messages.join('\n'))
  console.error('Refusing to silently drop related records. Re-export the source snapshot or pass --allow-missing-relations for an intentional partial snapshot.')
  process.exit(1)
}

const inputArg = requiredOption('--in')
const outputArg = requiredOption('--out')
const inputPath = resolve(process.cwd(), inputArg)
const outputPath = resolve(process.cwd(), outputArg)
const maxYear = parseIntegerOption('--max-year', 2025)
const minYear = parseIntegerOption('--min-year')
const explicitYears = parseYearList()
const includeAdmin = hasFlag('--include-admin')
const allowMissingRelations = hasFlag('--allow-missing-relations')

const snapshot = JSON.parse(await readFile(inputPath, 'utf8'))
if (snapshot.format !== 'fd-alumni-hub-next-prisma-export' || Number(snapshot.version) !== 1) {
  console.error('Unsupported snapshot format/version')
  process.exit(1)
}

const sourceRecords = snapshot.records || {}
const selectedTournaments = (sourceRecords.tournaments || []).filter((tournament) => {
  const year = recordYear(tournament)
  if (year === null) return false
  if (explicitYears?.length) return explicitYears.includes(year)
  if (minYear !== null && year < minYear) return false
  return year <= maxYear
})

const tournamentIds = byId(selectedTournaments)
const selectedTeams = filterByTournament(sourceRecords.teams || [], tournamentIds)
const teamIds = byId(selectedTeams)
const candidateGames = filterByTournament(sourceRecords.games || [], tournamentIds)
const missingTeamGames = candidateGames.filter((game) => !teamIds.has(game.homeTeamId) || !teamIds.has(game.awayTeamId))
const selectedGames = candidateGames.filter((game) => teamIds.has(game.homeTeamId) && teamIds.has(game.awayTeamId))
const candidateStandings = filterByTournament(sourceRecords.standings || [], tournamentIds)
const missingStandingTeams = candidateStandings.filter((standing) => !teamIds.has(standing.teamId))
const selectedStandings = candidateStandings.filter((standing) => teamIds.has(standing.teamId))

if (!allowMissingRelations) {
  failOnMissingRelations({ missingTeamGames, missingStandingTeams })
}

const selectedArticles = filterByTournament(sourceRecords.articleLinks || [], tournamentIds)
const selectedMedia = filterByTournament(sourceRecords.mediaAssets || [], tournamentIds)
const selectedSponsors = filterByTournament(sourceRecords.sponsors || [], tournamentIds)
const selectedIngest = filterByTournament(sourceRecords.contentIngestItems || [], tournamentIds)

const records = {
  tournaments: selectedTournaments,
  teams: selectedTeams,
  games: selectedGames,
  standings: selectedStandings,
  articleLinks: selectedArticles,
  mediaAssets: selectedMedia,
  sponsors: selectedSponsors,
  contentIngestItems: selectedIngest,
  adminWhitelists: includeAdmin ? (sourceRecords.adminWhitelists || []) : [],
  appUsers: includeAdmin ? (sourceRecords.appUsers || []) : [],
}

const filtered = {
  ...snapshot,
  exportedAt: snapshot.exportedAt,
  filteredAt: new Date().toISOString(),
  filter: {
    maxYear: explicitYears?.length ? null : maxYear,
    minYear,
    years: explicitYears || null,
    includeAdmin,
    allowMissingRelations,
    sourceFile: inputArg,
    droppedRelationships: {
      gamesMissingTeams: missingTeamGames.length,
      standingsMissingTeams: missingStandingTeams.length,
    },
  },
  counts: sortCounts(records),
  records,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(filtered, null, 2)}\n`)

const years = selectedTournaments.map((tournament) => tournament.year).sort((a, b) => a - b)
console.log(`Filtered Next/Prisma snapshot written to ${outputPath}`)
console.log(`Years: ${years.join(', ') || '(none)'}`)
if (missingTeamGames.length > 0 || missingStandingTeams.length > 0) {
  console.warn(`Dropped records with missing relationships: games=${missingTeamGames.length}, standings=${missingStandingTeams.length}`)
}
console.table(filtered.counts)
