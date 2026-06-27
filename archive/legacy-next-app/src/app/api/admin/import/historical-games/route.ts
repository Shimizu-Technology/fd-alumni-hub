import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { parse } from 'csv-parse/sync'
import { db } from '@/lib/db'

type Row = {
  year: string
  tournament_name: string
  game_date: string
  game_time?: string
  stage?: string
  division?: string
  home_team_label: string
  away_team_label: string
  home_score?: string
  away_score?: string
  status: 'scheduled' | 'live' | 'final'
  venue?: string
  stream_url?: string
  ticket_url?: string
  source_url?: string
  source_confidence?: string
  notes?: string
}

function must(v: string | undefined, k: string) {
  if (!v || !v.trim()) throw new Error(`Missing required field: ${k}`)
  return v.trim()
}

function parseStart(date: string, time?: string) {
  const t = (time && time.trim()) || '19:00'
  return new Date(`${date}T${t}:00.000Z`)
}

async function ensureTournament(year: number, name: string) {
  return db.tournament.upsert({
    where: { year_name: { year, name } },
    update: {},
    create: {
      year,
      name,
      status: 'completed',
      startDate: new Date(`${year}-06-01T00:00:00.000Z`),
      endDate: new Date(`${year}-08-01T00:00:00.000Z`),
    },
  })
}

async function ensureTeam(tournamentId: string, label: string, division?: string) {
  const displayName = `Class ${label}`
  return db.team.upsert({
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

export async function POST(request: Request) {
  // Admin-only by policy: historical imports can rewrite large portions of data.
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const text = await file.text()
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Row[]

  let upserts = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    try {
      const year = Number(must(r.year, 'year'))
      const tName = must(r.tournament_name, 'tournament_name')
      const homeLabel = must(r.home_team_label, 'home_team_label')
      const awayLabel = must(r.away_team_label, 'away_team_label')
      const gameDate = must(r.game_date, 'game_date')
      const status = must(r.status, 'status').toLowerCase() as Row['status']
      if (!['scheduled', 'live', 'final'].includes(status)) throw new Error(`Invalid status: ${status}`)

      const tournament = await ensureTournament(year, tName)
      const home = await ensureTeam(tournament.id, homeLabel, r.division)
      const away = await ensureTeam(tournament.id, awayLabel, r.division)
      if (home.id === away.id) throw new Error('home and away teams cannot be the same')

      const startTime = parseStart(gameDate, r.game_time)
      const homeScore = r.home_score && r.home_score !== '' ? Number(r.home_score) : null
      const awayScore = r.away_score && r.away_score !== '' ? Number(r.away_score) : null

      const notes = [
        r.stage ? `stage=${r.stage}` : null,
        r.source_confidence ? `confidence=${r.source_confidence}` : null,
        r.source_url ? `source=${r.source_url}` : null,
        r.notes || null,
      ].filter(Boolean).join(' | ')

      const existing = await db.game.findFirst({
        where: {
          tournamentId: tournament.id,
          homeTeamId: home.id,
          awayTeamId: away.id,
          startTime,
        },
      })

      if (existing) {
        await db.game.update({
          where: { id: existing.id },
          data: {
            status,
            homeScore,
            awayScore,
            venue: r.venue || 'FD Jungle',
            streamUrl: r.stream_url || null,
            ticketUrl: r.ticket_url || null,
            notes,
          },
        })
      } else {
        await db.game.create({
          data: {
            tournamentId: tournament.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            startTime,
            status,
            homeScore,
            awayScore,
            venue: r.venue || 'FD Jungle',
            streamUrl: r.stream_url || null,
            ticketUrl: r.ticket_url || null,
            notes,
          },
        })
      }

      upserts++
    } catch (e) {
      errors.push(`row ${i + 2}: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  return NextResponse.json({ ok: errors.length === 0, rows: rows.length, upserts, errors })
}
