import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { recomputeStandingsForTournament } from '@/lib/services/standings-recompute'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as { tournamentId?: string }
  if (!body.tournamentId) {
    return NextResponse.json({ ok: false, error: 'tournamentId required' }, { status: 400 })
  }

  try {
    const result = await recomputeStandingsForTournament(body.tournamentId)
    return NextResponse.json({ ok: true, result, recomputedAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to recompute standings',
      },
      { status: 500 },
    )
  }
}
