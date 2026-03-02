import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'
import { NewsCreateForm } from '@/components/admin/news-create-form'
import { AdminNewsList } from '@/components/admin/news-list'

export const dynamic = 'force-dynamic'

export default async function AdminNewsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const articles = await db.articleLink.findMany({ where: { tournamentId: tournament.id }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] })

  return (
    <section className="space-y-4">
      <AdminNav />
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · News</h1>
        <p className="text-sm text-neutral-600">Edit existing article links via API (UI CRUD next slice).</p>
      </div>
      <NewsCreateForm tournamentId={tournament.id} />
      <AdminNewsList initialArticles={articles as any} />
    </section>
  )
}
