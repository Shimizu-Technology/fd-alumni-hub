import type { ClassCohort } from './types'

type TeamWithClassCohorts = { classCohorts?: ClassCohort[] }

export type ClassCohortOption = Pick<ClassCohort, 'key' | 'graduationYear' | 'displayName' | 'shortLabel' | 'routeKey'>

export function classKeyForGraduationYear(year: number) {
  return String(year).slice(-2).padStart(2, '0')
}

export function graduationYearForClassKey(key: string) {
  const value = Number.parseInt(key, 10)
  if (Number.isNaN(value)) return null
  return value >= 50 ? 1900 + value : 2000 + value
}

export function classCohortOption(year: number): ClassCohortOption {
  const key = classKeyForGraduationYear(year)
  return {
    key,
    routeKey: key,
    graduationYear: year,
    displayName: `Class of ${year}`,
    shortLabel: String(year),
  }
}

export function classCohortOptions(existing: ClassCohort[] = [], maxYear = new Date().getFullYear()) {
  const firstYear = Math.min(1960, ...existing.map((cohort) => cohort.graduationYear))
  const lastYear = Math.max(maxYear, ...existing.map((cohort) => cohort.graduationYear))
  const options = new Map<string, ClassCohortOption>()

  for (let year = firstYear; year <= lastYear; year += 1) {
    const option = classCohortOption(year)
    options.set(option.key, option)
  }

  existing.forEach((cohort) => options.set(cohort.key, cohort))

  return Array.from(options.values()).sort((a, b) => b.graduationYear - a.graduationYear)
}

export function representedClassesLabel(team: TeamWithClassCohorts, fallback = 'Needs class mapping') {
  const cohorts = sortedClassCohorts(team.classCohorts)
  if (!cohorts.length) return fallback
  return cohorts.map((cohort) => cohort.displayName).join(' + ')
}

export function representedClassesSentence(team: TeamWithClassCohorts) {
  const label = representedClassesLabel(team, '')
  return label ? `Represents ${label}` : 'Needs class mapping'
}

export function selectedClassSummary(cohorts: ClassCohort[] | ClassCohortOption[]) {
  if (!cohorts.length) return 'No represented classes selected'
  return cohorts.map((cohort) => cohort.displayName).join(' + ')
}

export function sortedClassCohorts<T extends Pick<ClassCohort, 'graduationYear'>>(cohorts: T[] = []) {
  return [...cohorts].sort((a, b) => a.graduationYear - b.graduationYear)
}
