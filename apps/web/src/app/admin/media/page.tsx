import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { MediaCreateForm } from '@/components/admin/media-create-form'
import { AdminMediaList } from '@/components/admin/media-list'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const media = await db.mediaAsset.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ takenAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  })

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Media</h1>
        <p className="text-sm text-neutral-600">Manage gallery images by year/source. Add Clutch, GSPN, GuamPDN historical media assets.</p>
      </div>
      <MediaCreateForm tournamentId={tournament.id} />
      <AdminMediaList items={media as any} />
    </section>
  )
}
