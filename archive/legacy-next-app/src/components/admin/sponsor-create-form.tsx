'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import {
  AdminInput,
  AdminSelect,
  AdminButton,
  AdminCard,
  AdminCardTitle,
  AdminMessage,
} from './ui'

function isValidUrl(value: string) {
  if (!value) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function SponsorCreateForm({ tournamentId }: { tournamentId: string }) {
  const [name, setName] = useState('')
  const [tier, setTier] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!isValidUrl(targetUrl) || !isValidUrl(logoUrl)) {
      setMsg({ text: 'Please provide valid URL(s)', ok: false })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/sponsors/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          name,
          tier: tier || null,
          targetUrl: targetUrl || null,
          logoUrl: logoUrl || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMsg({ text: data?.error || 'Failed to create sponsor', ok: false })
        return
      }

      setMsg({ text: 'Sponsor added successfully', ok: true })
      router.refresh()

      // Reset form
      setName('')
      setTier('')
      setTargetUrl('')
      setLogoUrl('')
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
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50">
            <Heart className="h-5 w-5 text-pink-600" />
          </div>
          <AdminCardTitle className="mb-0">Add Sponsor</AdminCardTitle>
        </div>

        {/* Name */}
        <AdminInput
          label="Sponsor Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company or organization name"
          required
        />

        {/* Tier + URLs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <AdminSelect
            label="Tier"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option value="">— Select tier —</option>
            <option value="platinum">Platinum</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
            <option value="supporter">Supporter</option>
          </AdminSelect>
          <AdminInput
            label="Website URL"
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://..."
            hint="Link when clicking sponsor"
          />
          <AdminInput
            label="Logo URL"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            hint="PNG or SVG preferred"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
          <AdminButton type="submit" loading={loading}>
            Create Sponsor
          </AdminButton>
          {msg && <AdminMessage type={msg.ok ? 'success' : 'error'}>{msg.text}</AdminMessage>}
        </div>
      </form>
    </AdminCard>
  )
}
