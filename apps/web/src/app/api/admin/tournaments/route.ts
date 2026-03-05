import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tournaments = await db.tournament.findMany({
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
    },
  })

  const currentTournament =
    tournaments.find((t) => t.status === 'live') ||
    tournaments.find((t) => t.status === 'upcoming') ||
    tournaments[0] ||
    null

  return NextResponse.json({
    tournaments,
    currentTournamentId: currentTournament?.id ?? null,
  })
}
