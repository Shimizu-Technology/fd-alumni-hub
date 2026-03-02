import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    homeTeamId?: string
    awayTeamId?: string
    startTime?: string
    venue?: string
  }

  if (!body.tournamentId || !body.homeTeamId || !body.awayTeamId || !body.startTime) {
    return NextResponse.json({ error: 'tournamentId, homeTeamId, awayTeamId, startTime required' }, { status: 400 })
  }
  if (body.homeTeamId === body.awayTeamId) {
    return NextResponse.json({ error: 'home and away teams must be different' }, { status: 400 })
  }

  const tournament = await db.tournament.findUnique({ where: { id: body.tournamentId } })
  if (!tournament) return NextResponse.json({ error: 'invalid tournamentId' }, { status: 400 })

  const [home, away] = await Promise.all([
    db.team.findUnique({ where: { id: body.homeTeamId } }),
    db.team.findUnique({ where: { id: body.awayTeamId } }),
  ])
  if (!home || !away || home.tournamentId !== body.tournamentId || away.tournamentId !== body.tournamentId) {
    return NextResponse.json({ error: 'teams must belong to tournament' }, { status: 400 })
  }

  const game = await db.game.create({
    data: {
      tournamentId: body.tournamentId,
      homeTeamId: body.homeTeamId,
      awayTeamId: body.awayTeamId,
      startTime: new Date(body.startTime),
      venue: body.venue,
      status: 'scheduled',
    },
  })

  return NextResponse.json({ game })
}
