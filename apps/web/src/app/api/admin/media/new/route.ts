import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    source?: string
    title?: string
    imageUrl?: string
    articleUrl?: string | null
    caption?: string | null
    tags?: string | null
    takenAt?: string | null
  }

  if (!body.tournamentId || !body.source || !body.title || !body.imageUrl) {
    return NextResponse.json({ error: 'tournamentId, source, title, imageUrl required' }, { status: 400 })
  }

  if (!isValidHttpUrl(body.imageUrl) || !isValidHttpUrl(body.articleUrl)) {
    return NextResponse.json({ error: 'Invalid URL fields (http/https only)' }, { status: 400 })
  }

  const parsedTakenAt = body.takenAt ? new Date(body.takenAt) : null
  if (parsedTakenAt && Number.isNaN(parsedTakenAt.getTime())) {
    return NextResponse.json({ error: 'Invalid takenAt date' }, { status: 400 })
  }

  try {
    const media = await db.mediaAsset.create({
      data: {
        tournamentId: body.tournamentId,
        source: body.source,
        title: body.title,
        imageUrl: body.imageUrl,
        articleUrl: body.articleUrl || null,
        caption: body.caption || null,
        tags: body.tags || null,
        takenAt: parsedTakenAt,
      },
    })

    return NextResponse.json({ media })
  } catch (err) {
    console.error('[media/new] db.mediaAsset.create failed:', err)
    return NextResponse.json({ error: 'Failed to create media item' }, { status: 500 })
  }
}
