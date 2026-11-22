import { describe, expect, it } from 'vitest'
import { getDivision, orderedDivisions, resolveGameDivision } from '../divisions'

describe('divisions helpers', () => {
  it('looks up divisions case-insensitively', () => {
    expect(getDivision('maroon')?.id).toBe('Maroon')
    expect(getDivision('PLATINUM')?.id).toBe('Platinum')
    expect(getDivision('unknown')).toBeUndefined()
    expect(getDivision(null)).toBeUndefined()
  })

  it('orders active divisions by canonical sortOrder', () => {
    expect(orderedDivisions(['Special', 'Platinum', 'Maroon', 'Gold']).map((d) => d.id)).toEqual([
      'Maroon',
      'Gold',
      'Platinum',
      'Special',
    ])
  })

  it('resolves game division with team fallback', () => {
    expect(resolveGameDivision('Gold', 'Maroon')).toBe('Gold')
    expect(resolveGameDivision(null, 'Maroon')).toBe('Maroon')
    expect(resolveGameDivision(null, null)).toBeNull()
  })
})
