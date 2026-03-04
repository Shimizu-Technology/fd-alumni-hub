import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const item = await db.contentIngestItem.update({
    where: { id },
    data: { status: 'rejected' },
  })

  return NextResponse.json({ item })
}
