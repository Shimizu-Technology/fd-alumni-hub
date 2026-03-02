import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    name?: string
    logoUrl?: string | null
    targetUrl?: string | null
    tier?: string | null
    position?: number
  }

  if (!body.tournamentId || !body.name) {
    return NextResponse.json({ error: 'tournamentId and name required' }, { status: 400 })
  }

  const sponsor = await db.sponsor.create({
    data: {
      tournamentId: body.tournamentId,
      name: body.name,
      logoUrl: body.logoUrl,
      targetUrl: body.targetUrl,
      tier: body.tier,
      position: body.position ?? 0,
      active: true,
    },
  })

  return NextResponse.json({ sponsor })
}
