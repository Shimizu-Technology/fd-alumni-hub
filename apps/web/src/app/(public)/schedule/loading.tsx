export default function ScheduleLoading() {
  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="skeleton" style={{ height: '32px', width: '160px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '240px', borderRadius: '6px' }} />
      </div>

      {/* Day groups */}
      {[1, 2].map(d => (
        <div key={d} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-50)' }}>
            <div className="skeleton" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-4 px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="skeleton" style={{ height: '16px', width: '80px', borderRadius: '6px', flexShrink: 0 }} />
              <div className="flex-1 space-y-2">
                <div className="skeleton" style={{ height: '15px', width: '70%', borderRadius: '6px' }} />
                <div className="skeleton" style={{ height: '12px', width: '40%', borderRadius: '6px' }} />
              </div>
              <div className="skeleton" style={{ height: '24px', width: '70px', borderRadius: '20px', flexShrink: 0 }} />
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
