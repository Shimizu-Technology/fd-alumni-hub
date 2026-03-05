'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportHistoricalForm() {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('No file selected')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setMsg('Select a CSV file first.')
      return
    }

    const text = await file.text()

    setBusy(true)
    try {
      const res = await fetch('/api/admin/import/historical-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(data?.error || 'Import failed')
        return
      }
      setMsg(`Imported ${data?.imported ?? 0} rows. Skipped ${data?.skipped ?? 0}.`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Import Historical Games (CSV)</h2>

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="historical-csv"
          className="cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--neutral-100)', color: 'var(--neutral-800)' }}
        >
          Choose CSV File
        </label>
        <input
          id="historical-csv"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || 'No file selected')}
        />
        <span className="text-xs" style={{ color: 'var(--neutral-600)' }}>
          {fileName}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          className="rounded-lg px-3 py-2 text-sm text-white disabled:opacity-60"
          style={{ background: 'var(--fd-maroon)' }}
        >
          {busy ? 'Importing…' : 'Run Import'}
        </button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
