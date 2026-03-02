import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { recomputeStandingsForTournament } from '@/lib/services/standings-recompute'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { tournamentId?: string }
  if (!body.tournamentId) return NextResponse.json({ error: 'tournamentId required' }, { status: 400 })

  const result = await recomputeStandingsForTournament(body.tournamentId)
  return NextResponse.json({ ok: true, result })
}
