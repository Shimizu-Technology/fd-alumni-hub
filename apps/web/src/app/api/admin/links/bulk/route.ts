import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { isValidHttpUrl } from '@/lib/url'

/**
 * POST /api/admin/links/bulk
 * Body: { updates: { id: string; ticketUrl?: string | null; streamUrl?: string | null }[] }
 */
export async function POST(request: Request) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    updates?: { id: string; ticketUrl?: string | null; streamUrl?: string | null }[]
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const u of body.updates) {
    try {
      if (!u.id || typeof u.id !== 'string') {
        results.push({ id: String(u.id ?? ''), ok: false, error: 'Missing or invalid id' })
        continue
      }

      if ((u.ticketUrl && !isValidHttpUrl(u.ticketUrl)) || (u.streamUrl && !isValidHttpUrl(u.streamUrl))) {
        results.push({ id: u.id, ok: false, error: 'Invalid URL format (http/https only)' })
        continue
      }

      const data: Record<string, string | null | undefined> = {}
      if (Object.prototype.hasOwnProperty.call(u, 'ticketUrl')) data.ticketUrl = u.ticketUrl ?? null
      if (Object.prototype.hasOwnProperty.call(u, 'streamUrl')) data.streamUrl = u.streamUrl ?? null

      if (Object.keys(data).length === 0) {
        results.push({ id: u.id, ok: false, error: 'Nothing to update' })
        continue
      }

      await db.game.update({ where: { id: u.id }, data })
      results.push({ id: u.id, ok: true })
    } catch {
      results.push({ id: u.id, ok: false, error: 'Update failed' })
    }
  }

  const failed = results.filter((r) => !r.ok)
  return NextResponse.json({ results, saved: results.length - failed.length, failed: failed.length })
}
