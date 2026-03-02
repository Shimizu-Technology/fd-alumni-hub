import Link from 'next/link'

type UpdateItem = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: Date | null
}

export function LiveUpdates({ items }: { items: UpdateItem[] }) {
  if (items.length === 0) return null

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--fd-maroon)' }}>Latest Updates</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <Link href={item.url} target="_blank" className="font-medium hover:underline">
              {item.title}
            </Link>
            <p className="text-xs text-neutral-500">{item.source} · {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-US') : 'No date'}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
