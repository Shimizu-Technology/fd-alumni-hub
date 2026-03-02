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
