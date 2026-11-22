import type { Sponsor, SponsorTier } from './types'

export const SPONSOR_TIERS: readonly SponsorTier[] = [
  'diamond',
  'platinum',
  'gold',
  'silver',
  'community',
] as const

export const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  diamond: 'Diamond Sponsors',
  platinum: 'Platinum Sponsors',
  gold: 'Gold Sponsors',
  silver: 'Silver Sponsors',
  community: 'Community Partners',
}

export const SPONSOR_TIER_OPTIONS: Array<{ value: SponsorTier; label: string }> = [
  { value: 'diamond', label: 'Diamond Sponsor' },
  { value: 'platinum', label: 'Platinum Sponsor' },
  { value: 'gold', label: 'Gold Sponsor' },
  { value: 'silver', label: 'Silver Sponsor' },
  { value: 'community', label: 'Community Partner' },
]

export function normalizeSponsorTier(raw?: string | null): SponsorTier {
  const cleaned = (raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (cleaned === 'diamond' || cleaned === 'title' || cleaned === 'presenting' || cleaned === 'title sponsor' || cleaned === 'presenting sponsor') {
    return 'diamond'
  }
  if (cleaned === 'platinum') return 'platinum'
  if (cleaned === 'gold') return 'gold'
  if (cleaned === 'silver') return 'silver'
  return 'community'
}

export type SponsorTierGroup = {
  tier: SponsorTier
  label: string
  sponsors: Sponsor[]
}

export function groupSponsorsByTier(sponsors: Sponsor[]): SponsorTierGroup[] {
  const buckets: Record<SponsorTier, Sponsor[]> = {
    diamond: [],
    platinum: [],
    gold: [],
    silver: [],
    community: [],
  }

  for (const sponsor of sponsors) {
    const tier = normalizeSponsorTier(sponsor.tier)
    buckets[tier].push(sponsor)
  }

  return SPONSOR_TIERS
    .filter((tier) => buckets[tier].length > 0)
    .map((tier) => ({
      tier,
      label: SPONSOR_TIER_LABELS[tier],
      sponsors: [...buckets[tier]].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    }))
}
