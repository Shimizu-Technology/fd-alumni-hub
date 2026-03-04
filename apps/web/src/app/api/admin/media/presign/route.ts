import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { createImageUploadPost } from '@/lib/s3'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    filename?: string
    contentType?: string
  }

  if (!body.tournamentId || !body.filename || !body.contentType) {
    return NextResponse.json({ error: 'tournamentId, filename, contentType required' }, { status: 400 })
  }

  const tournament = await db.tournament.findUnique({ where: { id: body.tournamentId } })
  if (!tournament) {
    return NextResponse.json({ error: 'invalid tournamentId' }, { status: 400 })
  }

  if (!body.contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 })
  }

  try {
    const post = await createImageUploadPost({
      tournamentId: body.tournamentId,
      filename: body.filename,
      contentType: body.contentType,
    })

    return NextResponse.json({
      uploadUrl: post.url,
      fields: post.fields,
      key: post.key,
      publicUrl: post.publicUrl,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to create upload URL'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
