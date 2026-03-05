import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

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
  if (!isValidHttpUrl(body.logoUrl) || !isValidHttpUrl(body.targetUrl)) {
    return NextResponse.json({ error: 'Invalid URL fields (http/https only)' }, { status: 400 })
  }

  try {
    const sponsor = await db.sponsor.update({ where: { id }, data: body })
    return NextResponse.json({ sponsor })
  } catch {
    return NextResponse.json({ error: 'Failed to update sponsor' }, { status: 500 })
  }
}
