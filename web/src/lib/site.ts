const FALLBACK_SITE_URL = 'https://fd-alumni-tourney.netlify.app'

function normalizeSiteUrl(rawValue?: string) {
  const candidate = (rawValue || '').trim()
  if (!candidate) return FALLBACK_SITE_URL

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin
    }
  } catch {
    // Fall back to the default origin if the env value is invalid.
  }

  return FALLBACK_SITE_URL
}

export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL as string | undefined)
