'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { AdminButton, AdminCard, AdminCardTitle, AdminMessage } from './ui'

const TEMPLATE = `kind,source,title,url,image_url,excerpt,confidence,notes
article,GSPN,Sample Article,https://example.com/article,https://example.com/image.jpg,Short summary,confirmed,partner-import
media,Clutch,Sample Video,https://youtube.com/watch?v=abc123,https://i.ytimg.com/vi/abc123/hqdefault.jpg,,review-required,partner-import`

export function IngestImportForm({ tournamentId }: { tournamentId: string }) {
  const [csv, setCsv] = useState(TEMPLATE)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [errorPreview, setErrorPreview] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setErrorPreview([])
    setLoading(true)

    try {
      const res = await fetch('/api/admin/ingest/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          format: 'csv',
          csv,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMsg({ text: data?.error || 'Import failed', ok: false })
        return
      }

      const totalErrors = Number(data.totalErrors || 0)
      const truncated = Boolean(data.errorsTruncated)
      setMsg({
        text: `Queued: ${data.queued}, Skipped: ${data.skipped}${
          totalErrors ? `, Errors: ${totalErrors}${truncated ? ' (truncated)' : ''}` : ''
        }`,
        ok: totalErrors === 0,
      })
      setErrorPreview(Array.isArray(data.errors) ? data.errors.slice(0, 3) : [])
      router.refresh()
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <AdminCardTitle className="mb-0">Partner Bulk Import (CSV)</AdminCardTitle>
            <p className="text-xs text-[var(--neutral-400)]">
              Import from Clutch, GSPN, or GuamPDN partner exports
            </p>
          </div>
        </div>

        {/* Schema hint */}
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ background: 'var(--neutral-50)', borderColor: 'var(--border-subtle)' }}
        >
          <p className="font-semibold text-[var(--neutral-600)] mb-1">Expected columns:</p>
          <code className="text-[var(--fd-maroon)]">
            kind, source, title, url, image_url, excerpt, confidence, notes
          </code>
        </div>

        {/* CSV Textarea */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--neutral-500)]">
            CSV Data
          </label>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={8}
            className="w-full rounded-lg border px-3 py-2.5 text-xs font-mono bg-white text-[var(--fd-ink)] border-[var(--border-subtle)] placeholder:text-[var(--neutral-400)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--fd-maroon)]/20 focus:border-[var(--fd-maroon)]"
            placeholder="Paste CSV content here..."
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            Queue CSV Import
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>

        {/* Error preview */}
        {errorPreview.length > 0 && (
          <div
            className="rounded-lg border px-4 py-3"
            style={{ background: '#fef3c7', borderColor: '#fcd34d' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Import warnings
            </div>
            <ul className="space-y-1 text-xs text-amber-700">
              {errorPreview.map((e, i) => (
                <li key={`${i}-${e.slice(0, 24)}`}>• {e}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </AdminCard>
  )
}
