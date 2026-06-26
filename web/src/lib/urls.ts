export function externalHref(value?: string | null) {
  const url = value?.trim()
  if (!url) return null
  if (url.startsWith('//')) return `https:${url}`
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url

  return `https://${url}`
}
