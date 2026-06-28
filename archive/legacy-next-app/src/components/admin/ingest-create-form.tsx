'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidHttpUrl } from '@/lib/url'
import { Inbox } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
} from './ui'

export function IngestCreateForm({ tournamentId }: { tournamentId: string }) {
  const [kind, setKind] = useState<'article' | 'media'>('article')
  const [source, setSource] = useState('GSPN')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [confidence, setConfidence] = useState('confirmed')
  const [notes, setNotes] = useState('')
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
      const res = await fetch('/api/admin/ingest/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          kind,
          source,
          title,
          url,
          imageUrl: imageUrl || null,
          excerpt: excerpt || null,
          confidence: confidence || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data?.error || 'Failed to queue item', ok: false })
        return
      }

      setMsg({ text: 'Content queued for review', ok: true })
      router.refresh()

      // Reset form
      setTitle('')
      setUrl('')
      setImageUrl('')
      setExcerpt('')
      setNotes('')
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
            <Inbox className="h-5 w-5 text-purple-600" />
          </div>
          <AdminCardTitle className="mb-0">Queue Content for Review</AdminCardTitle>
        </div>

        {/* Type + Source + Confidence */}
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminSelect
            label="Content Type"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'article' | 'media')}
          >
            <option value="article">Article</option>
            <option value="media">Media/Photo</option>
          </AdminSelect>
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
          <AdminSelect
            label="Confidence"
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            <option value="confirmed">Confirmed</option>
            <option value="likely">Likely</option>
            <option value="uncertain">Uncertain</option>
          </AdminSelect>
        </div>

        {/* Title */}
        <AdminInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Content title or headline"
          required
        />

        {/* URLs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Source URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            required
          />
          <AdminInput
            label="Image URL"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (optional)"
          />
        </div>

        {/* Excerpt + Notes */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Excerpt/Cue"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief description (optional)"
          />
          <AdminInput
            label="Notes/Tags"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (optional)"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            Queue for Review
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
