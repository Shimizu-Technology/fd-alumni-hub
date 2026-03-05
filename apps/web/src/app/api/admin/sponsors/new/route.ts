import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

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

  const trimmedName = body.name?.trim()
  if (!body.tournamentId || !trimmedName) {
    return NextResponse.json({ error: 'tournamentId and name required' }, { status: 400 })
  }

  if (!isValidHttpUrl(body.logoUrl) || !isValidHttpUrl(body.targetUrl)) {
    return NextResponse.json({ error: 'Invalid URL fields (http/https only)' }, { status: 400 })
  }

  try {
    const sponsor = await db.sponsor.create({
      data: {
        tournamentId: body.tournamentId,
        name: trimmedName,
        logoUrl: body.logoUrl,
        targetUrl: body.targetUrl,
        tier: body.tier,
        position: body.position ?? 0,
        active: true,
      },
    })

    return NextResponse.json({ sponsor })
  } catch {
    return NextResponse.json({ error: 'Failed to create sponsor' }, { status: 500 })
  }
}
