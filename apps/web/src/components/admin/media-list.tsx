'use client'

import { Image as ImageIcon, ExternalLink, Calendar, Tag } from 'lucide-react'
import { AdminEmptyState, AdminBadge } from './ui'

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
      <AdminEmptyState
        icon={ImageIcon}
        title="No media assets yet"
        description="Upload images and videos from tournament coverage to build the gallery."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <article
          key={item.id}
          className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-fade-up"
          style={{
            borderColor: 'var(--border-subtle)',
            animationDelay: `${index * 50}ms`,
          }}
        >
          {/* Image */}
          <div className="relative aspect-[16/10] overflow-hidden bg-[var(--neutral-100)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            {/* Source badge overlay */}
            <div className="absolute left-2 top-2">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm"
                style={{
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                }}
              >
                {item.source}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="mb-2 font-semibold leading-snug text-[var(--fd-ink)] line-clamp-2 group-hover:text-[var(--fd-maroon)] transition-colors">
              {item.title}
            </h3>

            {item.caption && (
              <p className="mb-3 text-xs text-[var(--neutral-500)] line-clamp-2 leading-relaxed">
                {item.caption}
              </p>
            )}

            {/* Tags */}
            {item.tags && (
              <div className="mb-3 flex flex-wrap gap-1">
                {item.tags.split(',').slice(0, 3).map((tag) => (
                  <AdminBadge key={tag.trim()} variant="default">
                    <Tag className="mr-1 h-2.5 w-2.5" />
                    {tag.trim()}
                  </AdminBadge>
                ))}
                {item.tags.split(',').length > 3 && (
                  <AdminBadge variant="default">+{item.tags.split(',').length - 3}</AdminBadge>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--neutral-500)]">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {item.takenAt
                  ? new Date(item.takenAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'No date'}
              </span>
              {item.articleUrl && (
                <a
                  href={item.articleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 font-medium text-[var(--fd-maroon)] transition-colors hover:text-[var(--fd-maroon-dark)]"
                >
                  Article
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
