import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')
  if (!tournamentId) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 })

  const sponsors = await db.sponsor.findMany({
    where: { tournamentId },
    orderBy: [{ active: 'desc' }, { position: 'asc' }],
    take: 100,
  })
  return NextResponse.json({ sponsors })
}
