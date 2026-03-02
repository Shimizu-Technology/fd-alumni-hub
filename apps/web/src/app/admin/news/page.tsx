import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { getActiveTournament } from '@/lib/repositories/tournament-repo'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminNewsPage() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  const tournament = await getActiveTournament()
  if (!tournament) return <div className="rounded-xl border bg-white p-4">No active tournament found.</div>

  const articles = await db.articleLink.findMany({ where: { tournamentId: tournament.id }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] })

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin · News</h1>
        <p className="text-sm text-neutral-600">Edit existing article links via API (UI CRUD next slice).</p>
      </div>
      <div className="space-y-2">
        {articles.map((a) => (
          <div key={a.id} className="rounded-lg border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="font-medium">{a.title}</p>
            <p className="text-xs text-neutral-500">{a.source} · {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('en-US') : 'No date'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
