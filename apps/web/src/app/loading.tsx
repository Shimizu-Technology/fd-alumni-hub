export default function Loading() {
  return (
    <section className="space-y-4">
      <div className="h-44 animate-pulse rounded-3xl border bg-white/80" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border bg-white/80" />
        ))}
      </div>
      <div className="h-44 animate-pulse rounded-2xl border bg-white/80" />
    </section>
  )
}
