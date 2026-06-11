export const GUAM_TIME_ZONE = 'Pacific/Guam'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GUAM_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const guamDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: GUAM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const guamOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GUAM_TIME_ZONE,
  timeZoneName: 'longOffset',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function numericPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value
  if (!value) throw new Error(`Unable to read ${type} for ${GUAM_TIME_ZONE}`)
  return Number(value)
}

function guamDateParts(value: Date | string) {
  const parts = guamDatePartsFormatter.formatToParts(new Date(value))
  return {
    year: numericPart(parts, 'year'),
    month: numericPart(parts, 'month'),
    day: numericPart(parts, 'day'),
  }
}

function guamOffsetMs(value: Date) {
  const timeZoneName = guamOffsetFormatter
    .formatToParts(value)
    .find((part) => part.type === 'timeZoneName')?.value

  if (!timeZoneName || timeZoneName === 'GMT' || timeZoneName === 'UTC') return 0

  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(timeZoneName)
  if (!match) throw new Error(`Unable to parse ${GUAM_TIME_ZONE} offset: ${timeZoneName}`)

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? '0')
  return sign * (hours * 60 + minutes) * 60_000
}

function guamLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  const firstOffset = guamOffsetMs(utcGuess)
  const firstResult = new Date(utcGuess.getTime() - firstOffset)
  const adjustedOffset = guamOffsetMs(firstResult)

  return adjustedOffset === firstOffset
    ? firstResult
    : new Date(utcGuess.getTime() - adjustedOffset)
}

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
  const { year, month, day } = guamDateParts(value)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function guamDayRange(value = new Date()) {
  const { year, month, day } = guamDateParts(value)

  return {
    start: guamLocalDateTimeToUtc(year, month, day, 0, 0, 0, 0),
    end: guamLocalDateTimeToUtc(year, month, day, 23, 59, 59, 999),
  }
}

export function isPastGuamGame(value: Date | string, now = new Date()) {
  return new Date(value).getTime() < now.getTime()
}
