import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'FD Alumni Basketball Hub'
const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || 'https://fd-alumni-tourney.netlify.app').replace(/\/$/, '')
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`
const DEFAULT_DESCRIPTION = 'Central hub for FD Alumni Basketball Tournament schedules, standings, GuamTime tickets, Clutch streams, news, media, sponsors, and history.'

type SeoRoute = {
  title: string
  description: string
  robots?: string
}

const routeSeo: Record<string, SeoRoute> = {
  '/': {
    title: `${SITE_NAME} | Schedule, Standings, Tickets & Streams`,
    description: DEFAULT_DESCRIPTION,
  },
  '/today': {
    title: `Today at The Jungle | ${SITE_NAME}`,
    description: 'Game-day schedule, roster details, live links, and fan predictions for FD Alumni Basketball Tournament action in Guam.',
  },
  '/schedule': {
    title: `Tournament Schedule | ${SITE_NAME}`,
    description: 'View FD Alumni Basketball Tournament game times, matchups, divisions, ticket links, and stream links in Guam time.',
  },
  '/standings': {
    title: `Standings | ${SITE_NAME}`,
    description: 'Follow FD Alumni Basketball Tournament standings, records, point differential, and score coverage by division.',
  },
  '/watch': {
    title: `Watch & Tickets | ${SITE_NAME}`,
    description: 'Find partner links for GuamTime tickets, Clutch streams, local coverage, and FD Alumni Basketball Tournament game media.',
  },
  '/info': {
    title: `Rules & Tournament Info | ${SITE_NAME}`,
    description: 'Public tournament information, rules highlights, ticket guidance, and venue notes for the FD Alumni Basketball Tournament.',
  },
  '/news': {
    title: `News & Coverage | ${SITE_NAME}`,
    description: 'Browse FD Alumni Basketball Tournament coverage, GSPN links, partner articles, and local basketball updates.',
  },
  '/gallery': {
    title: `Gallery | ${SITE_NAME}`,
    description: 'Browse sourced FD Alumni Basketball Tournament photos, media links, and archived tournament images.',
  },
  '/history': {
    title: `Tournament History | ${SITE_NAME}`,
    description: 'Explore FD Alumni Basketball Tournament history, archived seasons, past scores, articles, and media links.',
  },
  '/sponsors': {
    title: `Sponsors | ${SITE_NAME}`,
    description: 'View FD Alumni Basketball Tournament sponsors, partner acknowledgements, and community supporters.',
  },
}

function seoForPath(pathname: string): SeoRoute {
  if (pathname.startsWith('/admin')) {
    return {
      title: `Admin | ${SITE_NAME}`,
      description: 'Secure admin workspace for FD Alumni Basketball Hub staff.',
      robots: 'noindex,nofollow',
    }
  }

  if (pathname.startsWith('/history/')) {
    const year = pathname.split('/').filter(Boolean)[1]
    return {
      title: `${year || 'Archive'} Tournament Archive | ${SITE_NAME}`,
      description: `Archived FD Alumni Basketball Tournament scores, articles, media, and research notes${year ? ` for ${year}` : ''}.`,
    }
  }

  return routeSeo[pathname] || routeSeo['/']
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector)

  if (!element) {
    element = document.createElement('link')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
}

export function SeoManager() {
  const location = useLocation()

  useEffect(() => {
    const route = seoForPath(location.pathname)
    const canonicalUrl = `${SITE_URL}${location.pathname === '/' ? '/' : location.pathname}`
    const robots = route.robots || 'index,follow'

    document.title = route.title

    upsertMeta('meta[name="title"]', { name: 'title', content: route.title })
    upsertMeta('meta[name="description"]', { name: 'description', content: route.description })
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots })

    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl })
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: route.title })
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: route.description })
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE })

    upsertMeta('meta[name="twitter:url"]', { name: 'twitter:url', content: canonicalUrl })
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: route.title })
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: route.description })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_IMAGE })

    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl })
  }, [location.pathname])

  return null
}
