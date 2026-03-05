'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { History } from 'lucide-react'
import { AdminFileInput, AdminButton, AdminCard, AdminCardTitle, AdminMessage } from './ui'

export function ImportHistoricalForm() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setMsg({ text: 'Please select a CSV file', ok: false })
      return
    }

    const text = await file.text()

    setLoading(true)
    try {
      const res = await fetch('/api/admin/import/historical-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setMsg({ text: data?.error || 'Import failed', ok: false })
        return
      }

      setMsg({
        text: `Imported ${data?.imported ?? 0} rows. Skipped ${data?.skipped ?? 0}.`,
        ok: true,
      })
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50">
            <History className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <AdminCardTitle className="mb-0">Import Historical Games</AdminCardTitle>
            <p className="text-xs text-[var(--neutral-400)]">
              Upload CSV with past tournament results
            </p>
          </div>
        </div>

        {/* File upload with hidden input */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--neutral-500)]">
            CSV File
          </label>
          <div className="relative">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
              onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
            />
            <div className="flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 border-[var(--border-subtle)] bg-[var(--bg-card-subtle)] transition-all duration-150 peer-hover:border-[var(--fd-maroon)]/50 peer-hover:bg-[var(--fd-maroon)]/5 peer-focus:border-[var(--fd-maroon)] peer-focus:ring-2 peer-focus:ring-[var(--fd-maroon)]/20">
              <History className="h-5 w-5 shrink-0 text-[var(--neutral-400)]" />
              <div className="min-w-0 flex-1">
                {fileName ? (
                  <p className="truncate text-sm font-medium text-[var(--fd-ink)]">{fileName}</p>
                ) : (
                  <p className="text-sm text-[var(--neutral-500)]">Click to select CSV file</p>
                )}
                <p className="text-xs text-[var(--neutral-400)]">
                  Expected: date, away_team, home_team, away_score, home_score, division
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            {loading ? 'Importing…' : 'Run Import'}
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
