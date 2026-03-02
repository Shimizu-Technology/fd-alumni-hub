import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'

export default async function AdminHome() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  return (
    <section className="space-y-4">
      <AdminNav />
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--fd-maroon)' }}>Admin Console</h1>
      <p className="text-neutral-600">Authenticated as {user.email} ({user.role}).</p>
      <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
        Next: wire schedule/standings/checklist admin modules.
      </div>
    </section>
  )
}
