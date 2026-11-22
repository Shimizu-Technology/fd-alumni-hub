import { describe, expect, it } from 'vitest'
import {
  classKeyForGraduationYear,
  graduationYearForClassKey,
  representedClassesLabel,
  representedClassesSentence,
} from '../classes'

describe('classes helpers', () => {
  it('maps class keys and graduation years across 1900s and 2000s', () => {
    expect(classKeyForGraduationYear(2017)).toBe('17')
    expect(classKeyForGraduationYear(2005)).toBe('05')
    expect(classKeyForGraduationYear(1996)).toBe('96')
    expect(graduationYearForClassKey('17')).toBe(2017)
    expect(graduationYearForClassKey('96')).toBe(1996)
    expect(graduationYearForClassKey('bad')).toBeNull()
  })

  it('sorts and joins represented class cohorts', () => {
    const label = representedClassesLabel({
      classCohorts: [
        { id: '2', key: '03', routeKey: '03', graduationYear: 2003, displayName: 'Class of 2003', shortLabel: '2003' },
        { id: '1', key: '99', routeKey: '99', graduationYear: 1999, displayName: 'Class of 1999', shortLabel: '1999' },
      ],
    })
    expect(label).toBe('Class of 1999 + Class of 2003')
    expect(representedClassesSentence({ classCohorts: [] })).toBe('Needs class mapping')
  })
})
