export function QuickCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub ? <p className="mt-1 text-sm text-neutral-500">{sub}</p> : null}
    </div>
  )
}
