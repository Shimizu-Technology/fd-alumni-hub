import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    status?: 'scheduled' | 'live' | 'final'
    homeScore?: number | null
    awayScore?: number | null
    streamUrl?: string | null
    ticketUrl?: string | null
  }

  const game = await db.game.update({
    where: { id },
    data: {
      status: body.status,
      homeScore: body.homeScore,
      awayScore: body.awayScore,
      streamUrl: body.streamUrl,
      ticketUrl: body.ticketUrl,
    },
  })

  return NextResponse.json({ game })
}
