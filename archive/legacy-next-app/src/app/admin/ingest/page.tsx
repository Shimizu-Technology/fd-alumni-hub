import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { IngestCreateForm } from '@/components/admin/ingest-create-form'
import { IngestImportForm } from '@/components/admin/ingest-import-form'
import { IngestReviewList } from '@/components/admin/ingest-review-list'

export const dynamic = 'force-dynamic'

export default async function AdminIngestPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const items = await db.contentIngestItem.findMany({
    where: { tournamentId: tournament.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  })

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · Ingestion Queue</h1>
        <p className="text-sm text-neutral-600">Queue scraped/manual content and approve it into Articles/Media with attribution.</p>
      </div>
      <IngestCreateForm tournamentId={tournament.id} />
      <IngestImportForm tournamentId={tournament.id} />
      <IngestReviewList items={items} />
    </section>
  )
}
