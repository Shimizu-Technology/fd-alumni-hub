'use client'

import { useState } from 'react'

export function SponsorCreateForm({ tournamentId }: { tournamentId: string }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    const res = await fetch('/api/admin/sponsors/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, name, tier: tier || null, targetUrl: targetUrl || null, logoUrl: logoUrl || null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setMsg(data?.error || 'Failed')
      return
    }
    setMsg('Created. Refresh page to see latest.')
    setName('')
    setTier('')
    setTargetUrl('')
    setLogoUrl('')
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl border bg-white p-4" style={{ borderColor: 'var(--border-subtle)' }}>
      <h2 className="text-sm font-semibold">Add Sponsor</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border px-2 py-2 text-sm" required />
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Tier" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="Target URL" className="rounded-lg border px-2 py-2 text-sm" />
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Logo URL" className="rounded-lg border px-2 py-2 text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <button className="rounded-lg px-3 py-2 text-sm text-white" style={{ background: 'var(--fd-maroon)' }}>Create</button>
        {msg ? <p className="text-xs text-neutral-600">{msg}</p> : null}
      </div>
    </form>
  )
}
