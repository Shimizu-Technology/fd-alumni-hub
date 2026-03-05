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
      throw new Error(data?.error || 'Could not prepare upload. Please try again.')
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
      throw new Error('Image upload failed. Please retry.')
    }

    return data.publicUrl as string
  }

  const createMedia = async () => {
    setMsg(null)
    let stage: 'create' | null = null

    if ((imageUrl && !isValidHttpUrl(imageUrl)) || (articleUrl && !isValidHttpUrl(articleUrl))) {
      setMsg({ text: 'Please provide valid URLs (http/https).', ok: false })
      return
    }

    if (!imageUrl && !imageFile) {
      setMsg({ text: 'Provide an image URL or upload an image file.', ok: false })
      return
    }

    try {
      setUploading(true)
      const resolvedImageUrl = imageFile ? await uploadToS3(imageFile) : imageUrl

      stage = 'create'
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
        throw new Error(data?.error || 'Failed to create media item. Please retry.')
      }

      setMsg({ text: 'Media item added successfully', ok: true })
      router.refresh()

      // Reset form only on success
      setTitle('')
      setImageUrl('')
      setImageFile(null)
      setArticleUrl('')
      setCaption('')
      setTags('')
      setTakenAt('')
      setSource('GSPN')
    } catch (err) {
      const prefix = stage === 'create' ? 'Create step failed:' : 'Upload flow failed:'
      setMsg({ text: `${prefix} ${err instanceof Error ? err.message : 'Please retry.'}`, ok: false })
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await createMedia()
  }

  return (
    <AdminCard>
      <form onSubmit={submit} className="space-y-4">
        <AdminCardTitle>Add Media Asset</AdminCardTitle>

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

        <AdminInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a descriptive title"
          required
        />

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

        <AdminFileInput
          label="Or Upload Image"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          selectedFileName={imageFile?.name}
          hint="JPG, PNG, WebP up to 10MB"
        />

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

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <AdminButton type="submit" loading={uploading}>
            {uploading ? 'Uploading…' : 'Create Media Item'}
          </AdminButton>
          {!uploading && msg && !msg.ok && (
            <AdminButton type="button" variant="secondary" onClick={createMedia}>
              Retry
            </AdminButton>
          )}
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
