export default function Loading() {
  return (
    <section className="space-y-6">
      {/* Hero skeleton */}
      <div className="skeleton rounded-2xl" style={{ height: '260px' }} />

      {/* Stats skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ height: '96px' }} />
        ))}
      </div>

      {/* Feed skeleton */}
      <div
        className="rounded-xl border bg-white overflow-hidden"
        style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="skeleton rounded-none" style={{ height: '52px' }} />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex-1 space-y-2">
              <div className="skeleton" style={{ height: '10px', width: '80px', borderRadius: '6px' }} />
              <div className="skeleton" style={{ height: '14px', width: '85%', borderRadius: '6px' }} />
              <div className="skeleton" style={{ height: '12px', width: '60px', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
