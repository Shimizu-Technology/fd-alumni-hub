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

  if (item.kind === 'media' && !item.imageUrl) {
    return NextResponse.json({ error: 'Media item requires imageUrl' }, { status: 400 })
  }

  const updated = await db.$transaction(async (tx) => {
    let importedToId: string | null = null

    if (item.kind === 'article') {
      const article = await tx.articleLink.create({
        data: {
          tournamentId: item.tournamentId,
          title: item.title,
          source: item.source,
          url: item.url,
          imageUrl: item.imageUrl,
          excerpt: item.excerpt,
        },
      })
      importedToId = article.id
    } else {
      const media = await tx.mediaAsset.create({
        data: {
          tournamentId: item.tournamentId,
          source: item.source,
          title: item.title,
          imageUrl: item.imageUrl!,
          articleUrl: item.url,
          caption: item.excerpt,
          tags: item.notes,
        },
      })
      importedToId = media.id
    }

    return tx.contentIngestItem.update({
      where: { id: item.id },
      data: { status: 'approved', importedToId },
    })
  })

  return NextResponse.json({ item: updated })
}
