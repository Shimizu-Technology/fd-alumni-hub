import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/authz'
import { db } from '@/lib/db'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tournaments = await db.tournament.findMany({ orderBy: { year: 'desc' }, take: 50 })
  return NextResponse.json({ tournaments })
}
