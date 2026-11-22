import { describe, expect, it } from 'vitest'
import { auditFieldDiff, auditFieldLabel } from '../audit'

describe('auditFieldDiff', () => {
  it('shows added, changed and removed fields and ignores bookkeeping or object key order', () => {
    expect(auditFieldDiff({
      before: { away_score: 54, home_score: 58, notes: 'Draft', updated_at: 'old', options: { a: 1, b: 2 } },
      after: { away_score: 54, home_score: 60, status: 'final', updated_at: 'new', options: { b: 2, a: 1 } },
      legacySource: null,
    })).toEqual([
      { field: 'home_score', before: 58, after: 60 },
      { field: 'notes', before: 'Draft', after: undefined },
      { field: 'status', before: undefined, after: 'final' },
    ])
    expect(auditFieldLabel('tournament_id')).toBe('Tournament ID')
  })

  it('uses finance change pairs and preserves archive warning lists', () => {
    expect(auditFieldDiff({
      before: {},
      after: { changes: { amount_cents: [100, 200], warnings_at_archive: ['income', 'expense'] } },
      legacySource: 'finance_audit_events',
    })).toEqual([
      { field: 'amount_cents', before: 100, after: 200 },
      { field: 'warnings_at_archive', before: undefined, after: ['income', 'expense'] },
    ])
  })
})
