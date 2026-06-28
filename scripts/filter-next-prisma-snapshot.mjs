#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function usage() {
  console.error(`Usage: node scripts/filter-next-prisma-snapshot.mjs --in <snapshot.json> --out <filtered.json> [--max-year 2025] [--min-year 2000] [--years 2024,2025] [--include-admin]

Creates a relationship-safe Next/Prisma snapshot subset for Rails import.
Defaults are intentionally production-safe for this repo: historical years only (--max-year 2025) and no old admin/user records.`)
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

const inputPath = resolve(process.cwd(), requiredOption('--in'))
const outputPath = resolve(process.cwd(), requiredOption('--out'))
const maxYear = Number(optionValue('--max-year') || 2025)
const minYearValue = optionValue('--min-year')
const minYear = minYearValue ? Number(minYearValue) : null
const explicitYears = optionValue('--years')
  ?.split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value))
const includeAdmin = hasFlag('--include-admin')

if (!explicitYears?.length && !Number.isInteger(maxYear)) {
  console.error('--max-year must be an integer when --years is not provided')
  process.exit(1)
}

if (minYear !== null && !Number.isInteger(minYear)) {
  console.error('--min-year must be an integer')
  process.exit(1)
}

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
const selectedGames = filterByTournament(sourceRecords.games || [], tournamentIds)
  .filter((game) => teamIds.has(game.homeTeamId) && teamIds.has(game.awayTeamId))
const selectedStandings = filterByTournament(sourceRecords.standings || [], tournamentIds)
  .filter((standing) => teamIds.has(standing.teamId))
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
    sourcePath: inputPath,
  },
  counts: sortCounts(records),
  records,
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(filtered, null, 2)}\n`)

const years = selectedTournaments.map((tournament) => tournament.year).sort((a, b) => a - b)
console.log(`Filtered Next/Prisma snapshot written to ${outputPath}`)
console.log(`Years: ${years.join(', ') || '(none)'}`)
console.table(filtered.counts)
