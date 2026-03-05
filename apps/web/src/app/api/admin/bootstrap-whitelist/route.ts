import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Intentionally secret-guarded instead of role-guarded for first-user bootstrap flows.
export async function POST(request: Request) {
  const secret = request.headers.get('x-bootstrap-secret')
  if (!process.env.BOOTSTRAP_SECRET || secret !== process.env.BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string }
  const email = body.email?.toLowerCase()
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const entry = await db.adminWhitelist.upsert({
    where: { email },
    update: { isActive: true, role: 'admin' },
    create: { email, role: 'admin', isActive: true, notes: 'Bootstrap admin' },
  })

  return NextResponse.json({ ok: true, entry })
}
