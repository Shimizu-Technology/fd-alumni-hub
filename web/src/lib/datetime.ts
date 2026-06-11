const GUAM_TZ = 'Pacific/Guam'

const guamOffsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: GUAM_TZ,
  timeZoneName: 'longOffset',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function guamOffsetMs(value: Date) {
  const timeZoneName = guamOffsetFormatter
    .formatToParts(value)
    .find((part) => part.type === 'timeZoneName')?.value

  if (!timeZoneName || timeZoneName === 'GMT' || timeZoneName === 'UTC') return 0

  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(timeZoneName)
  if (!match) throw new Error(`Unable to parse ${GUAM_TZ} offset: ${timeZoneName}`)

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? '0')
  return sign * (hours * 60 + minutes) * 60_000
}

function guamLocalDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  const firstOffset = guamOffsetMs(utcGuess)
  const firstResult = new Date(utcGuess.getTime() - firstOffset)
  const adjustedOffset = guamOffsetMs(firstResult)

  return adjustedOffset === firstOffset
    ? firstResult
    : new Date(utcGuess.getTime() - adjustedOffset)
}

export function formatGuamDate(value?: string | Date | null, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return 'TBD'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: GUAM_TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(date)
}

export function formatGuamTime(value?: string | Date | null) {
  if (!value) return 'TBD'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: GUAM_TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatGuamDateTime(value?: string | Date | null) {
  if (!value) return 'TBD'
  return `${formatGuamDate(value, { weekday: 'short', year: undefined })} · ${formatGuamTime(value)}`
}

export function guamDayLabel(value?: string | Date | null) {
  if (!value) return 'TBD'
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: GUAM_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function isPastGuamGame(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.getTime() < Date.now()
}

export function toDateInputValue(value?: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return value.slice(0, 10)
}

export function toLocalDateTimeInputValue(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: GUAM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return formatter.format(date).replace(' ', 'T')
}

export function guamLocalDateTimeInputToIso(value: string) {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return guamLocalDateTimeToUtc(year, month, day, hour, minute).toISOString()
}
