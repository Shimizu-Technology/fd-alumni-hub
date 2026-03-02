import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    logoUrl?: string | null
    targetUrl?: string | null
    tier?: string | null
    active?: boolean
    position?: number
  }
  const sponsor = await db.sponsor.update({ where: { id }, data: body })
  return NextResponse.json({ sponsor })
}
