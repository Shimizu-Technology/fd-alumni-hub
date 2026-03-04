export default function WatchLoading() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton" style={{ height: '32px', width: '140px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '200px', borderRadius: '6px' }} />
      </div>

      <div className="space-y-3">
        <div className="skeleton" style={{ height: '14px', width: '100px', borderRadius: '6px' }} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border bg-white p-5 space-y-4" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex justify-between">
                <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '20px' }} />
                <div className="skeleton" style={{ height: '14px', width: '80px', borderRadius: '6px' }} />
              </div>
              <div className="space-y-2">
                <div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '6px' }} />
                <div className="skeleton" style={{ height: '12px', width: '20px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '16px', width: '70%', borderRadius: '6px' }} />
              </div>
              <div className="skeleton" style={{ height: '44px', borderRadius: '12px' }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
