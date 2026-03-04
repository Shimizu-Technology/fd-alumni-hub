export default function StandingsLoading() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <div className="skeleton" style={{ height: '32px', width: '180px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '220px', borderRadius: '6px' }} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-elevated)' }}>
        {/* Table header */}
        <div className="px-5 py-3.5 border-b flex gap-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-50)' }}>
          {[40, 160, 40, 40, 40, 40, 40].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: '12px', width: `${w}px`, borderRadius: '6px' }} />
          ))}
        </div>
        {/* Rows */}
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="flex gap-4 items-center px-5 py-3.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="skeleton" style={{ height: '28px', width: '28px', borderRadius: '50%', flexShrink: 0 }} />
            <div className="skeleton" style={{ height: '14px', width: '140px', borderRadius: '6px' }} />
            <div className="skeleton ml-auto" style={{ height: '14px', width: '30px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '14px', width: '30px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '14px', width: '40px', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </section>
  )
}
