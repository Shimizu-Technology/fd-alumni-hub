export function QuickCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white/90 p-5 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
      <p className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold leading-none text-[color:var(--fd-ink)]">{value}</p>
      {sub ? <p className="mt-2 text-sm text-neutral-500">{sub}</p> : null}
    </div>
  )
}
