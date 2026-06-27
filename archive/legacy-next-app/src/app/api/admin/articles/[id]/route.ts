import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    source?: string
    url?: string
    publishedAt?: string | null
  }
  const article = await db.articleLink.update({
    where: { id },
    data: {
      title: body.title,
      source: body.source,
      url: body.url,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : body.publishedAt === null ? null : undefined,
    },
  })
  return NextResponse.json({ article })
}
