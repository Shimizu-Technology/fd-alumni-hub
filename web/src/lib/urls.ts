export function numericSearchParam(name: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && /^\d{4}$/.test(value) ? Number(value) : null
}

export function externalHref(value?: string | null) {
  const url = value?.trim()
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    return /^https?:/i.test(url) ? url : null
  }

  return `https://${url}`
}

export function safeHttpsHref(value?: string | null) {
  const url = value?.trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.username || parsed.password) return null
    if (parsed.protocol === 'https:') return parsed.toString()
    if (import.meta.env.DEV && parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

export function safePublicImageHref(value?: string | null) {
  if (!value || /[\\\s\x00-\x1f\x7f]/.test(value)) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  return safeHttpsHref(value)
}

export type NormalizedUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string }

export function normalizeHttpsInput(value?: string | null, label = 'URL'): NormalizedUrlResult {
  const raw = value?.trim()
  if (!raw) return { ok: true, url: null }

  let candidate = raw
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`
  } else if (/^http:\/\//i.test(candidate)) {
    const devLocalhost = import.meta.env.DEV && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(candidate)
    if (!devLocalhost) candidate = `https://${candidate.slice(7)}`
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  const normalized = safeHttpsHref(candidate)
  if (!normalized) {
    return { ok: false, error: `${label} must be a valid https:// URL` }
  }

  return { ok: true, url: normalized }
}
