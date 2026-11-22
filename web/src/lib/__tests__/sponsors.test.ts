import { describe, expect, it } from 'vitest'
import { groupSponsorsByTier, normalizeSponsorTier, SPONSOR_TIER_LABELS } from '../sponsors'
import type { Sponsor } from '../types'

function makeSponsor(overrides: Partial<Sponsor>): Sponsor {
  return {
    id: '1',
    tournamentId: '1',
    name: 'Partner',
    logoUrl: null,
    targetUrl: null,
    tier: 'community',
    tierLabel: 'Community Partners',
    description: null,
    active: true,
    position: 0,
    ...overrides,
  }
}

describe('sponsors helper', () => {
  it('normalizes canonical and legacy tier names safely', () => {
    expect(normalizeSponsorTier('diamond')).toBe('diamond')
    expect(normalizeSponsorTier('Title Sponsor')).toBe('diamond')
    expect(normalizeSponsorTier('Presenting')).toBe('diamond')
    expect(normalizeSponsorTier('PLATINUM')).toBe('platinum')
    expect(normalizeSponsorTier('Gold')).toBe('gold')
    expect(normalizeSponsorTier('silver')).toBe('silver')
    expect(normalizeSponsorTier('Community Partner')).toBe('community')
    expect(normalizeSponsorTier('Bronze')).toBe('community')
    expect(normalizeSponsorTier('')).toBe('community')
    expect(normalizeSponsorTier(null)).toBe('community')
  })

  it('groups sponsors in strict Diamond -> Platinum -> Gold -> Silver -> Community order and omits empty tiers', () => {
    const groups = groupSponsorsByTier([
      makeSponsor({ id: '1', name: 'Community B', tier: 'community', position: 2 }),
      makeSponsor({ id: '2', name: 'Gold A', tier: 'gold', position: 1 }),
      makeSponsor({ id: '3', name: 'Diamond A', tier: 'diamond', position: 3 }),
      makeSponsor({ id: '4', name: 'Community A', tier: 'community', position: 1 }),
      makeSponsor({ id: '5', name: 'Platinum A', tier: 'platinum', position: 0 }),
    ])

    expect(groups.map((g) => g.tier)).toEqual(['diamond', 'platinum', 'gold', 'community'])
    expect(groups.map((g) => g.label)).toEqual([
      SPONSOR_TIER_LABELS.diamond,
      SPONSOR_TIER_LABELS.platinum,
      SPONSOR_TIER_LABELS.gold,
      SPONSOR_TIER_LABELS.community,
    ])
    expect(groups[3].sponsors.map((s) => s.name)).toEqual(['Community A', 'Community B'])
  })
})
