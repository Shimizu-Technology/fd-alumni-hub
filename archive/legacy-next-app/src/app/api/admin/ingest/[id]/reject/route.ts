import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const item = await db.contentIngestItem.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.status !== 'pending') {
    return NextResponse.json({ error: 'Item already processed' }, { status: 400 })
  }

  const updated = await db.contentIngestItem.update({
    where: { id },
    data: { status: 'rejected' },
  })

  return NextResponse.json({ item: updated })
}
