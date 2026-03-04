type MediaItem = {
  id: string
  source: string
  title: string
  imageUrl: string
  articleUrl: string | null
  caption: string | null
  tags: string | null
  takenAt: Date | string | null
}

export function AdminMediaList({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-4 text-sm text-neutral-600" style={{ borderColor: 'var(--border-subtle)' }}>
        No media assets yet.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border bg-white p-3" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="h-36 w-full rounded-md object-cover" />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{item.source}</p>
          <p className="mt-1 font-medium leading-snug">{item.title}</p>
          {item.caption ? <p className="mt-1 text-xs text-neutral-600 line-clamp-2">{item.caption}</p> : null}
          <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
            <span>{item.takenAt ? new Date(item.takenAt).toLocaleDateString('en-US') : 'No date'}</span>
            {item.articleUrl ? <a href={item.articleUrl} target="_blank" rel="noreferrer" className="underline">Article</a> : null}
          </div>
        </article>
      ))}
    </div>
  )
}
