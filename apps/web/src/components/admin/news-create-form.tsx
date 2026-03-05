'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidHttpUrl } from '@/lib/url'
import { Newspaper } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
} from './ui'

export function NewsCreateForm({ tournamentId }: { tournamentId: string }) {
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('GSPN')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!isValidHttpUrl(url) || (imageUrl && !isValidHttpUrl(imageUrl))) {
      setMsg({ text: 'Please provide valid URL(s)', ok: false })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/articles/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          title,
          source,
          url,
          imageUrl: imageUrl || null,
          excerpt: excerpt || null,
          publishedAt: publishedAt || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data?.error || 'Failed to create article', ok: false })
        return
      }

      setMsg({ text: 'News article added successfully', ok: true })
      router.refresh()

      // Reset form
      setTitle('')
      setUrl('')
      setImageUrl('')
      setExcerpt('')
    } catch {
      setMsg({ text: 'Something went wrong', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminCard>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <Newspaper className="h-5 w-5 text-blue-600" />
          </div>
          <AdminCardTitle className="mb-0">Add News Link</AdminCardTitle>
        </div>

        {/* Title */}
        <AdminInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article headline"
          required
        />

        {/* Source + Date + URL */}
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminSelect
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
          >
            <option value="GSPN">GSPN</option>
            <option value="Clutch">Clutch Guam</option>
            <option value="GuamPDN">Guam PDN</option>
            <option value="Other">Other</option>
          </AdminSelect>
          <AdminInput
            label="Published Date"
            type="date"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
          <AdminInput
            label="Article URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            required
          />
        </div>

        {/* Image URL + Excerpt */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Image URL"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (optional)"
            hint="Thumbnail for the article"
          />
          <AdminInput
            label="Excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief summary (optional)"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            Create News Link
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
