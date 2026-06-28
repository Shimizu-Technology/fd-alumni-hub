export function numericSearchParam(name: string) {
  const value = new URLSearchParams(window.location.search).get(name)
  return value && /^\d{4}$/.test(value) ? Number(value) : null
}

export function externalHref(value?: string | null) {
  const url = value?.trim()
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url

  return `https://${url}`
}
