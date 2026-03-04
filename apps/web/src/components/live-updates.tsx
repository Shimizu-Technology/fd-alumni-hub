import Link from 'next/link'

type UpdateItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: Date | null
}

export function LiveUpdates({ items }: { items: UpdateItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border bg-white/90 p-5" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-maroon)' }}>Latest Updates</h2>
        <p className="mt-2 text-sm text-neutral-500">No article links yet. Add links in Admin / News to power this section.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-white/90 p-5" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-maroon)' }}>Latest Updates</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-transparent px-2 py-2 text-sm hover:border-[color:var(--border-subtle)]">
            <Link href={item.url} target="_blank" className="font-medium text-[color:var(--fd-ink)] hover:underline">
              {item.title}
            </Link>
            <p className="text-xs text-neutral-500">{item.source} · {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US') : 'No date'}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
