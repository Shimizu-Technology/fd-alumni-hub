import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    title?: string
    source?: string
    url?: string
    publishedAt?: string | null
  }

  if (!body.tournamentId || !body.title || !body.source || !body.url) {
    return NextResponse.json({ error: 'tournamentId, title, source, url required' }, { status: 400 })
  }

  const article = await db.articleLink.create({
    data: {
      tournamentId: body.tournamentId,
      title: body.title,
      source: body.source,
      url: body.url,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    },
  })

  return NextResponse.json({ article })
}
