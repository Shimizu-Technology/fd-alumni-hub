import { AdminNav } from '@/components/admin/admin-nav'
import { HistoricalImportForm } from '@/components/admin/historical-import-form'
import { DataHealthCard } from '@/components/admin/data-health-card'

export default async function AdminHome() {
  return (
    <section className="space-y-4">
      <AdminNav />

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
