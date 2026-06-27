'use client'

import { useState } from 'react'
import { History, AlertTriangle } from 'lucide-react'
import { AdminFileInput, AdminButton, AdminCard, AdminCardTitle, AdminMessage } from './ui'

export function HistoricalImportForm() {
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      setMsg({ text: 'Please select a CSV file', ok: false })
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
        setMsg({ text: data?.error || 'Import failed', ok: false })
        return
      }

      setMsg({
        text: `Processed ${data.rows} rows, upserted ${data.upserts} games`,
        ok: true,
      })
      setErrors(data.errors || [])
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
            <History className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <AdminCardTitle className="mb-0">Import Historical Games</AdminCardTitle>
            <p className="text-xs text-[var(--neutral-400)]">
              Upload CSV with past tournament game results
            </p>
          </div>
        </div>

        {/* File upload */}
        <AdminFileInput
          label="CSV File"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          selectedFileName={file?.name}
          hint="Expected columns: date, away_team, home_team, away_score, home_score, division"
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            {loading ? 'Importing…' : 'Run Import'}
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>

        {/* Error list */}
        {errors.length > 0 && (
          <div
            className="rounded-lg border px-4 py-3"
            style={{ background: '#fef2f2', borderColor: '#fecaca' }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-red-800 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Import errors ({errors.length})
            </div>
            <ul className="max-h-32 overflow-y-auto space-y-1 text-xs text-red-700">
              {errors.map((err, i) => (
                <li key={`${i}-${err.slice(0, 20)}`}>• {err}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </AdminCard>
  )
}
