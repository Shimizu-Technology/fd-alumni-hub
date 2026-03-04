import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

type Row = {
  kind?: string
  source?: string
  title?: string
  url?: string
  image_url?: string
  imageUrl?: string
  excerpt?: string
  confidence?: string
  notes?: string
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows: Row[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',')
    const r: Record<string, string> = {}
    headers.forEach((h, idx) => {
      r[h] = (cells[idx] ?? '').trim()
    })
    rows.push(r)
  }
  return rows
}

export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    tournamentId?: string
    format?: 'csv' | 'json'
    rows?: Row[]
    csv?: string
    defaultSource?: string
    defaultKind?: 'article' | 'media'
  }

  if (!body.tournamentId) {
    return NextResponse.json({ error: 'tournamentId required' }, { status: 400 })
  }

  const tournament = await db.tournament.findUnique({ where: { id: body.tournamentId } })
  if (!tournament) return NextResponse.json({ error: 'invalid tournamentId' }, { status: 400 })

  const rows = body.format === 'csv' ? parseCsv(body.csv ?? '') : (body.rows ?? [])
  if (!rows.length) return NextResponse.json({ error: 'no rows supplied' }, { status: 400 })

  let queued = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    const kind = (row.kind || body.defaultKind || 'article').toLowerCase()
    const source = row.source || body.defaultSource || 'Partner'
    const title = row.title || ''
    const url = row.url || ''
    const imageUrl = row.image_url || row.imageUrl || ''

    if (!title || !url) {
      skipped++
      errors.push(`Missing required title/url for row: ${JSON.stringify(row).slice(0, 120)}`)
      continue
    }

    if (!isValidHttpUrl(url) || !isValidHttpUrl(imageUrl)) {
      skipped++
      errors.push(`Invalid URL fields for title: ${title}`)
      continue
    }

    const exists = await db.contentIngestItem.findFirst({
      where: { tournamentId: body.tournamentId, url },
      select: { id: true },
    })
    if (exists) {
      skipped++
      continue
    }

    await db.contentIngestItem.create({
      data: {
        tournamentId: body.tournamentId,
        kind: kind === 'media' ? 'media' : 'article',
        status: 'pending',
        source,
        title,
        url,
        imageUrl: imageUrl || null,
        excerpt: row.excerpt || null,
        confidence: row.confidence || 'review-required',
        notes: row.notes || 'partner-import',
      },
    })
    queued++
  }

  return NextResponse.json({ queued, skipped, errors: errors.slice(0, 30) })
}
