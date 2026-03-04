'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TEMPLATE = `kind,source,title,url,image_url,excerpt,confidence,notes
article,GSPN,Sample Article,https://example.com/article,https://example.com/image.jpg,Short summary,confirmed,partner-import
media,Clutch,Sample Video,https://youtube.com/watch?v=abc123,https://i.ytimg.com/vi/abc123/hqdefault.jpg,,review-required,partner-import`

export function IngestImportForm({ tournamentId }: { tournamentId: string }) {
  const [csv, setCsv] = useState(TEMPLATE)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
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
        setMsg(data?.error || 'Import failed')
        return
      }
      setMsg(`Queued: ${data.queued}, Skipped: ${data.skipped}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Partner Bulk Import (CSV)</h2>
      <p className="text-xs text-neutral-600">
        Paste CSV from Clutch/GSPN/GuamPDN using this schema: kind,source,title,url,image_url,excerpt,confidence,notes
      </p>
      <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className="rounded-lg border p-2 text-xs font-mono" />
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60" style={{ background: 'var(--fd-maroon)' }}>
          {busy ? 'Importing…' : 'Queue CSV'}
        </button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
