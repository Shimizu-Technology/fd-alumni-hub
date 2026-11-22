import { describe, expect, it } from 'vitest'
import {
  formatGuamDate,
  formatGuamDateTime,
  formatGuamTime,
  guamLocalDateTimeInputToIso,
  toDateInputValue,
  toLocalDateTimeInputValue,
} from '../datetime'

describe('Guam datetime helpers', () => {
  it('converts Guam local datetime input (UTC+10) to UTC ISO and back', () => {
    const iso = guamLocalDateTimeInputToIso('2027-06-25T18:00')
    expect(iso).toBe('2027-06-25T08:00:00.000Z')
    expect(toLocalDateTimeInputValue(iso)).toBe('2027-06-25T18:00')
  })

  it('formats dates and times in Pacific/Guam', () => {
    expect(formatGuamDate('2027-06-25T08:00:00.000Z')).toBe('Jun 25, 2027')
    expect(formatGuamTime('2027-06-25T08:00:00.000Z')).toBe('6:00 PM')
    expect(formatGuamDateTime('2027-06-25T08:00:00.000Z')).toContain('6:00 PM')
  })

  it('handles blank values cleanly', () => {
    expect(formatGuamDate(null)).toBe('TBD')
    expect(formatGuamTime(undefined)).toBe('TBD')
    expect(formatGuamDateTime('')).toBe('TBD')
    expect(toDateInputValue('2027-06-25T08:00:00Z')).toBe('2027-06-25')
    expect(toDateInputValue('2027-06-25')).toBe('2027-06-25')
    expect(toDateInputValue('')).toBe('')
  })
})
