'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isValidHttpUrl } from '@/lib/url'
import {
  AdminInput,
  AdminSelect,
  AdminFileInput,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
} from './ui'

export function MediaCreateForm({ tournamentId }: { tournamentId: string }) {
  const [source, setSource] = useState('GSPN')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [articleUrl, setArticleUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const uploadToS3 = async (file: File) => {
    const presign = await fetch('/api/admin/media/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournamentId,
        filename: file.name,
        contentType: file.type || 'image/jpeg',
      }),
    })

    if (!presign.ok) {
      const data = await presign.json().catch(() => ({}))
      throw new Error(data?.error || 'Failed to create upload URL')
    }

    const data = await presign.json()
    const form = new FormData()
    for (const [k, v] of Object.entries(data.fields as Record<string, string>)) {
      form.append(k, v)
    }
    form.append('file', file)

    const uploadRes = await fetch(data.uploadUrl as string, {
      method: 'POST',
      body: form,
    })

    if (!uploadRes.ok) {
      throw new Error(`Upload failed (${uploadRes.status})`)
    }

    return data.publicUrl as string
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if ((imageUrl && !isValidHttpUrl(imageUrl)) || (articleUrl && !isValidHttpUrl(articleUrl))) {
      setMsg({ text: 'Please provide valid URLs', ok: false })
      return
    }

    if (!imageUrl && !imageFile) {
      setMsg({ text: 'Provide an image URL or upload an image file', ok: false })
      return
    }

    try {
      setUploading(true)
      const resolvedImageUrl = imageFile ? await uploadToS3(imageFile) : imageUrl

      const res = await fetch('/api/admin/media/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          source,
          title,
          imageUrl: resolvedImageUrl,
          articleUrl: articleUrl || null,
          caption: caption || null,
          tags: tags || null,
          takenAt: takenAt || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data?.error || 'Failed to create media item', ok: false })
        return
      }

      setMsg({ text: 'Media item added successfully', ok: true })
      router.refresh()

      // Reset form
      setTitle('')
      setImageUrl('')
      setImageFile(null)
      setArticleUrl('')
      setCaption('')
      setTags('')
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Upload failed', ok: false })
    } finally {
      setUploading(false)
    }
  }

  return (
    <AdminCard>
      <form onSubmit={submit} className="space-y-4">
        <AdminCardTitle>Add Media Asset</AdminCardTitle>

        {/* Row 1: Source + Date */}
        <div className="grid gap-3 sm:grid-cols-2">
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
            label="Date Taken"
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            hint="When was this photo/video taken?"
          />
        </div>

        {/* Row 2: Title */}
        <AdminInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a descriptive title"
          required
        />

        {/* Row 3: Image URL + Article URL */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Image URL"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            hint="Optional if uploading a file below"
          />
          <AdminInput
            label="Article URL"
            type="url"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="https://example.com/article"
            hint="Link to original article (optional)"
          />
        </div>

        {/* Row 4: File Upload */}
        <AdminFileInput
          label="Or Upload Image"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          selectedFileName={imageFile?.name}
          hint="JPG, PNG, WebP up to 10MB"
        />

        {/* Row 5: Caption + Tags */}
        <div className="grid gap-3 sm:grid-cols-2">
          <AdminInput
            label="Caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Brief description for display"
          />
          <AdminInput
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="championship, playoffs, boys-25"
            hint="Comma-separated"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <AdminButton type="submit" loading={uploading}>
            {uploading ? 'Uploading…' : 'Create Media Item'}
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
