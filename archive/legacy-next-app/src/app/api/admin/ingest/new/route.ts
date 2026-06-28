import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    kind?: 'article' | 'media'
    source?: string
    title?: string
    url?: string
    imageUrl?: string | null
    excerpt?: string | null
    confidence?: string | null
    notes?: string | null
  }

  if (!body.tournamentId || !body.kind || !body.source || !body.title || !body.url) {
    return NextResponse.json({ error: 'tournamentId, kind, source, title, url required' }, { status: 400 })
  }
  if (!isValidHttpUrl(body.url) || !isValidHttpUrl(body.imageUrl)) {
    return NextResponse.json({ error: 'Invalid URL fields (http/https only)' }, { status: 400 })
  }

  const tournament = await db.tournament.findUnique({ where: { id: body.tournamentId } })
  if (!tournament) return NextResponse.json({ error: 'invalid tournamentId' }, { status: 400 })

  const item = await db.contentIngestItem.create({
    data: {
      tournamentId: body.tournamentId,
      kind: body.kind,
      source: body.source,
      title: body.title,
      url: body.url,
      imageUrl: body.imageUrl || null,
      excerpt: body.excerpt || null,
      confidence: body.confidence || null,
      notes: body.notes || null,
    },
  })

  return NextResponse.json({ item })
}
