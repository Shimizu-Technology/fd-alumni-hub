import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireStaff } from '@/lib/authz'

export async function GET() {
  const user = await requireStaff()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tournaments = await db.tournament.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      status: true,
      startDate: true,
      endDate: true,
    },
    orderBy: [{ year: 'desc' }, { name: 'asc' }],
  })

  return NextResponse.json(tournaments)
}
