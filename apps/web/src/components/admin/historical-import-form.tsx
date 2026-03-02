'use client'

import { useState } from 'react'

export function HistoricalImportForm() {
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setMsg('Please select a CSV file')
      return
    }

    setLoading(true)
    setMsg(null)
    setErrors([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/import/historical-games', {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data?.error || 'Import failed')
        return
      }
      setMsg(`Processed ${data.rows} rows, upserted ${data.upserts}`)
      setErrors(data.errors || [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Import Historical Games (CSV)</h2>
      <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      <div className="flex items-center gap-3">
        <button disabled={loading} className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>
          {loading ? 'Importing…' : 'Run Import'}
        </button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
      {errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-red-700">
          {errors.map((err) => <li key={err}>{err}</li>)}
        </ul>
      ) : null}
    </form>
  )
}
