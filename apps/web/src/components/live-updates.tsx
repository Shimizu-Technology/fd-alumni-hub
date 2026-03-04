import Link from 'next/link'

type UpdateItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: Date | null
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2 10L10 2M10 2H6M10 2V6" />
    </svg>
  )
}

export function LiveUpdates({ items }: { items: UpdateItem[] }) {
  return (
    <div
      className="rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: 'var(--fd-maroon)' }}
          />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--fd-ink)' }}>
            Latest Updates
          </h2>
        </div>
        <Link
          href="/news"
          className="text-xs font-medium transition-colors hover:underline"
          style={{ color: 'var(--fd-maroon)' }}
        >
          All news
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: 'var(--neutral-500)' }}>
            No updates yet. Add article links in Admin / News to power this section.
          </p>
        </div>
      ) : (
        <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties} role="list">
          {items.map((item, i) => (
            <li key={item.id} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
              <Link
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-neutral-50"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1"
                    style={{ color: 'var(--fd-maroon)' }}
                  >
                    {item.source}
                  </p>
                  <h3
                    className="text-sm font-medium leading-snug line-clamp-2 transition-colors group-hover:underline"
                    style={{ color: 'var(--fd-ink)', textDecorationColor: 'var(--fd-maroon)' }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--neutral-400)' }}>
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'No date'}
                  </p>
                </div>
                <span
                  className="mt-1 shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--fd-maroon)' }}
                >
                  <ExternalLinkIcon />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
