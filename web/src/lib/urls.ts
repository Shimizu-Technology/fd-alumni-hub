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
    if (parsed.protocol === 'https:') return parsed.toString()
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}
