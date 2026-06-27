import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { findActiveTournament } from '@/lib/tournament-utils'

export async function GET() {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tournaments = await db.tournament.findMany({
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
    take: 100,
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
    },
  })

  const currentTournament = findActiveTournament(tournaments)

  return NextResponse.json({
    tournaments,
    currentTournamentId: currentTournament?.id ?? null,
  })
}
