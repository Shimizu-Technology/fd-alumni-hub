import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { SponsorCreateForm } from '@/components/admin/sponsor-create-form'
import { AdminSponsorsList } from '@/components/admin/sponsors-list'

export const dynamic = 'force-dynamic'

export default async function AdminSponsorsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const sponsors = await db.sponsor.findMany({ where: { tournamentId: tournament.id }, orderBy: [{ active: 'desc' }, { position: 'asc' }] })

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Sponsors</h1>
        <p className="text-sm text-neutral-600">Edit sponsors via API patch endpoint (full CRUD UI next slice).</p>
      </div>
      <SponsorCreateForm tournamentId={tournament.id} />
      <AdminSponsorsList initialSponsors={sponsors as any} />
    </section>
  )
}
