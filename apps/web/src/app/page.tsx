import { QuickCard } from '@/components/quick-card'

export default function Home() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border bg-white p-6" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--fd-maroon)' }}>FD Alumni Basketball Hub</h1>
        <p className="mt-2 text-neutral-600">Single source of truth for schedule, standings, watch links, tickets, and updates.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard title="Games Today" value="0" sub="Connect data source" />
        <QuickCard title="Live Now" value="0" sub="Clutch integration" />
        <QuickCard title="Teams" value="0" sub="Tournament roster" />
        <QuickCard title="Updates" value="0" sub="GSPN + official" />
      </div>
    </section>
  )
}
