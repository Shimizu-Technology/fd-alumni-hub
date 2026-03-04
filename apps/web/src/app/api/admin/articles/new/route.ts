import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

function isValidHttpUrl(value: string | null | undefined) {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    title?: string
    source?: string
    url?: string
    imageUrl?: string | null
    excerpt?: string | null
    publishedAt?: string | null
  }

  if (!body.tournamentId || !body.title || !body.source || !body.url) {
    return NextResponse.json({ error: 'tournamentId, title, source, url required' }, { status: 400 })
  }

  if (!isValidHttpUrl(body.url) || !isValidHttpUrl(body.imageUrl)) {
    return NextResponse.json({ error: 'Invalid URL fields (http/https only)' }, { status: 400 })
  }

  const article = await db.articleLink.create({
    data: {
      tournamentId: body.tournamentId,
      title: body.title,
      source: body.source,
      url: body.url,
      imageUrl: body.imageUrl || null,
      excerpt: body.excerpt || null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
    },
  })

  return NextResponse.json({ article })
}
