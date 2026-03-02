#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { PrismaClient } from '../../apps/web/node_modules/@prisma/client/index.js'

const prisma = new PrismaClient()

function required(v, name) {
  if (!v || String(v).trim() === '') throw new Error(`Missing required field: ${name}`)
  return String(v).trim()
}

function isoDate(year, date, time) {
  const y = required(year, 'year')
  const d = required(date, 'game_date')
  const t = (time || '19:00').trim()
  return new Date(`${d}T${t}:00.000Z`)
}

async function ensureTournament(year, name) {
  return prisma.tournament.upsert({
    where: { year_name: { year: Number(year), name } },
    update: {},
    create: {
      year: Number(year),
      name,
      status: 'completed',
      startDate: new Date(`${year}-06-01T00:00:00.000Z`),
      endDate: new Date(`${year}-08-01T00:00:00.000Z`),
    },
  })
}

async function ensureTeam(tournamentId, label, division) {
  const displayName = `Class ${label}`
  return prisma.team.upsert({
    where: { tournamentId_displayName: { tournamentId, displayName } },
    update: { division: division || 'Open' },
    create: {
      tournamentId,
      classYearLabel: label,
      displayName,
      division: division || 'Open',
    },
  })
}

async function run(filePath) {
  const full = path.resolve(filePath)
  const csv = fs.readFileSync(full, 'utf8')
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true })

  let upserts = 0
  for (const row of rows) {
    const year = required(row.year, 'year')
    const tName = required(row.tournament_name, 'tournament_name')
    const homeLabel = required(row.home_team_label, 'home_team_label')
    const awayLabel = required(row.away_team_label, 'away_team_label')
    const status = (row.status || 'final').toLowerCase()
    if (!['scheduled', 'live', 'final'].includes(status)) throw new Error(`Invalid status: ${status}`)

    const tournament = await ensureTournament(year, tName)
    const home = await ensureTeam(tournament.id, homeLabel, row.division)
    const away = await ensureTeam(tournament.id, awayLabel, row.division)

    if (home.id === away.id) throw new Error(`Home/Away same team in row for ${row.game_date}`)

    const startTime = isoDate(year, row.game_date, row.game_time)
    const homeScore = row.home_score !== '' ? Number(row.home_score) : null
    const awayScore = row.away_score !== '' ? Number(row.away_score) : null

    await prisma.game.upsert({
      where: {
        tournamentId_homeTeamId_awayTeamId_startTime: {
          tournamentId: tournament.id,
          homeTeamId: home.id,
          awayTeamId: away.id,
          startTime,
        },
      },
      update: {
        status,
        homeScore,
        awayScore,
        venue: row.venue || 'FD Jungle',
        streamUrl: row.stream_url || null,
        ticketUrl: row.ticket_url || null,
        notes: [
          row.stage ? `stage=${row.stage}` : null,
          row.source_confidence ? `confidence=${row.source_confidence}` : null,
          row.source_url ? `source=${row.source_url}` : null,
          row.notes || null,
        ].filter(Boolean).join(' | '),
      },
      create: {
        tournamentId: tournament.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        startTime,
        status,
        homeScore,
        awayScore,
        venue: row.venue || 'FD Jungle',
        streamUrl: row.stream_url || null,
        ticketUrl: row.ticket_url || null,
        notes: [
          row.stage ? `stage=${row.stage}` : null,
          row.source_confidence ? `confidence=${row.source_confidence}` : null,
          row.source_url ? `source=${row.source_url}` : null,
          row.notes || null,
        ].filter(Boolean).join(' | '),
      },
    })

    upserts += 1
  }

  return { rows: rows.length, upserts }
}

const input = process.argv[2] || './templates/fd_historical_games_import.csv'
run(input)
  .then((out) => {
    console.log(JSON.stringify({ ok: true, ...out }, null, 2))
    return prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
