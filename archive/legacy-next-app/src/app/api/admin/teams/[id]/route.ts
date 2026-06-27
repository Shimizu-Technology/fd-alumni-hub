import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authz'
import { db } from '@/lib/db'
import { DIVISIONS } from '@/lib/divisions'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    division?: string | null
  }

  // Validate division if provided
  if (body.division && !DIVISIONS.find(d => d.id === body.division)) {
    return NextResponse.json(
      { error: `Unknown division "${body.division}". Valid: ${DIVISIONS.map(d => d.id).join(', ')}` },
      { status: 400 }
    )
  }

  const team = await db.team.update({
    where: { id },
    data: {
      ...(Object.prototype.hasOwnProperty.call(body, 'division') ? { division: body.division } : {}),
    },
  })

  return NextResponse.json({ team })
}
