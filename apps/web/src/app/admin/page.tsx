import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/authz'
import { AdminNav } from '@/components/admin/admin-nav'
import { HistoricalImportForm } from '@/components/admin/historical-import-form'
import { DataHealthCard } from '@/components/admin/data-health-card'
import { Shield } from 'lucide-react'

export default async function AdminHome() {
  const user = await requireStaff()
  if (!user) redirect('/sign-in')

  return (
    <section className="space-y-4">
      <AdminNav />

      {/* Page header */}
      <div
        className="rounded-xl border bg-white p-5 shadow-sm"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: 'var(--fd-maroon)' }}
          >
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--fd-maroon)]">Admin Console</h1>
            <p className="text-sm text-[var(--neutral-500)]">
              Authenticated as{' '}
              <span className="font-medium text-[var(--fd-ink)]">{user.email}</span>
              <span
                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: 'var(--fd-gold-light)',
                  color: 'var(--fd-maroon-dark)',
                }}
              >
                {user.role}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Quick access cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAccessCard
          href="/admin/games"
          label="Games"
          description="Manage schedules & scores"
          color="var(--fd-maroon)"
        />
        <QuickAccessCard
          href="/admin/links"
          label="Bulk Links"
          description="Add ticket & stream URLs"
          color="#2563eb"
        />
        <QuickAccessCard
          href="/admin/media"
          label="Media"
          description="Upload photos & videos"
          color="#7c3aed"
        />
        <QuickAccessCard
          href="/admin/ingest"
          label="Ingestion"
          description="Review queued content"
          color="#059669"
        />
      </div>

      <DataHealthCard />

      <HistoricalImportForm />
    </section>
  )
}

function QuickAccessCard({
  href,
  label,
  description,
  color,
}: {
  href: string
  label: string
  description: string
  color: string
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-3 w-3 rounded-full transition-transform duration-200 group-hover:scale-125"
          style={{ background: color }}
        />
        <span className="font-semibold text-[var(--fd-ink)] group-hover:text-[var(--fd-maroon)] transition-colors">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--neutral-500)]">{description}</p>
    </a>
  )
}
