import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminSponsorsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const sponsors = await db.sponsor.findMany({ where: { tournamentId: tournament.id }, orderBy: [{ active: 'desc' }, { position: 'asc' }] })

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Sponsors</h1>
        <p className="text-sm text-neutral-600">Edit sponsors via API patch endpoint (full CRUD UI next slice).</p>
      </div>
      <div className="space-y-2">
        {sponsors.map((s) => (
          <div key={s.id} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-neutral-500">tier: {s.tier ?? 'n/a'} · active: {s.active ? 'yes' : 'no'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
