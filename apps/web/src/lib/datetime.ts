export const GUAM_TIME_ZONE = 'Pacific/Guam'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GUAM_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export function formatGuamTime(value: Date | string) {
  return new Date(value).toLocaleTimeString('en-US', {
    timeZone: GUAM_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatGuamDate(value: Date | string, options?: Intl.DateTimeFormatOptions) {
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: GUAM_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  })
}

export function formatGuamDateTime(value: Date | string) {
  const d = new Date(value)
  return `${dateFormatter.format(d)} · ${formatGuamTime(d)}`
}

export function guamDayLabel(value: Date | string) {
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: GUAM_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function guamDateKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: GUAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  return `${year}-${month}-${day}`
}

export function guamDayRange(value = new Date()) {
  const key = guamDateKey(value)
  return {
    start: new Date(`${key}T00:00:00+10:00`),
    end: new Date(`${key}T23:59:59.999+10:00`),
  }
}

export function isPastGuamGame(value: Date | string, now = new Date()) {
  return new Date(value).getTime() < now.getTime()
}
