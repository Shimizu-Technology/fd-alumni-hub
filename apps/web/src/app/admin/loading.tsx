export default function AdminLoading() {
  return (
    <section className="space-y-4 animate-fade-up">
      {/* Nav skeleton */}
      <div className="rounded-xl border bg-white p-1.5 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-9 rounded-lg"
              style={{ width: `${80 + Math.random() * 40}px`, animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Page header skeleton */}
      <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="skeleton mb-2 h-7 w-48 rounded-md" />
        <div className="skeleton h-4 w-64 rounded-md" />
      </div>

      {/* Form/card skeleton */}
      <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="skeleton mb-4 h-5 w-32 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-10 rounded-lg" />
          <div className="skeleton h-10 rounded-lg" />
        </div>
        <div className="skeleton mt-3 h-10 rounded-lg" />
        <div className="mt-4 flex gap-2">
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* List skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-white p-4 shadow-sm"
            style={{ borderColor: 'var(--border-subtle)', animationDelay: `${(i + 1) * 100}ms` }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="skeleton h-5 w-3/4 rounded-md" />
                <div className="skeleton h-3 w-1/2 rounded-md" />
              </div>
              <div className="skeleton h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
