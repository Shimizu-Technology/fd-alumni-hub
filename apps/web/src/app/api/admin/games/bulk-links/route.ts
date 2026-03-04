import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'

/**
 * POST /api/admin/games/bulk-links
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
      const data: Record<string, string | null | undefined> = {}
      if (Object.prototype.hasOwnProperty.call(u, 'ticketUrl')) data.ticketUrl = u.ticketUrl ?? null
      if (Object.prototype.hasOwnProperty.call(u, 'streamUrl')) data.streamUrl = u.streamUrl ?? null

      if (Object.keys(data).length === 0) {
        results.push({ id: u.id, ok: false, error: 'Nothing to update' })
        continue
      }

      await db.game.update({ where: { id: u.id }, data })
      results.push({ id: u.id, ok: true })
    } catch (e) {
      results.push({ id: u.id, ok: false, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }

  const failed = results.filter(r => !r.ok)
  return NextResponse.json({ results, saved: results.length - failed.length, failed: failed.length })
}
