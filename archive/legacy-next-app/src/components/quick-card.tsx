export function QuickCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string
  value: string
  sub?: string
  accent?: 'maroon' | 'gold' | 'live' | 'neutral'
}) {
  const accentColor =
    accent === 'gold' ? 'var(--fd-gold)'
    : accent === 'live' ? 'var(--status-live)'
    : accent === 'neutral' ? 'var(--neutral-500)'
    : 'var(--fd-maroon)'

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
        borderTop: `3px solid ${accentColor}`,
      }}
    >
      {/* Background orb */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-10"
        style={{ background: accentColor, filter: 'blur(16px)' }}
      />

      <p
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'var(--neutral-500)' }}
      >
        {title}
      </p>
      <p
        className="mt-2.5 text-3xl font-bold leading-none tracking-tight"
        style={{ color: accent === 'live' ? 'var(--status-live)' : 'var(--fd-ink)', fontFamily: 'var(--font-sora)' }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-2 text-xs" style={{ color: 'var(--neutral-500)' }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}
