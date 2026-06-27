export default function NewsLoading() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="skeleton" style={{ height: '32px', width: '120px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '200px', borderRadius: '6px' }} />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-xl border bg-white p-5" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
            <div className="skeleton mb-2" style={{ height: '20px', width: '70px', borderRadius: '20px' }} />
            <div className="skeleton mb-2" style={{ height: '16px', width: '85%', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '12px', width: '100px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </section>
  )
}
