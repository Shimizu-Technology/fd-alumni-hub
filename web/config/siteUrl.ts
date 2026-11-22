import type { Plugin } from 'vite'

export const DEFAULT_SITE_URL = 'https://fd-alumni-tourney.netlify.app'
export const SITE_URL_TOKEN = '%VITE_SITE_URL%'

const SITEMAP_PATHS = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/host-year', changefreq: 'weekly', priority: '0.98' },
  { path: '/today', changefreq: 'daily', priority: '0.98' },
  { path: '/schedule', changefreq: 'daily', priority: '0.95' },
  { path: '/standings', changefreq: 'daily', priority: '0.9' },
  { path: '/watch', changefreq: 'daily', priority: '0.9' },
  { path: '/info', changefreq: 'weekly', priority: '0.85' },
  { path: '/news', changefreq: 'weekly', priority: '0.8' },
  { path: '/gallery', changefreq: 'weekly', priority: '0.75' },
  { path: '/history', changefreq: 'monthly', priority: '0.7' },
  { path: '/sponsors', changefreq: 'weekly', priority: '0.7' },
]

export function normalizeSiteUrl(rawValue?: string | null): string {
  const candidate = String(rawValue || '').trim()
  if (!candidate) return DEFAULT_SITE_URL

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin
    }
  } catch {
    // Fall through to default when misconfigured.
  }

  return DEFAULT_SITE_URL
}

export function renderSiteHtml(html: string, siteUrl?: string | null): string {
  const origin = normalizeSiteUrl(siteUrl)
  return html.replaceAll(SITE_URL_TOKEN, origin)
}

export function buildRobotsTxt(siteUrl?: string | null): string {
  const origin = normalizeSiteUrl(siteUrl)
  return [
    '# FD Alumni Basketball Tournament Hub',
    `# ${origin}`,
    '',
    'User-agent: *',
    'Allow: /',
    '',
    'Disallow: /admin',
    'Disallow: /admin/*',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function buildSitemapXml(siteUrl?: string | null): string {
  const origin = normalizeSiteUrl(siteUrl)
  const urls = SITEMAP_PATHS.map(({ path, changefreq, priority }) => [
    '  <url>',
    `    <loc>${origin}${path}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n')).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function siteUrlPlugin(siteUrl?: string | null): Plugin {
  const resolved = normalizeSiteUrl(siteUrl)

  return {
    name: 'fd-alumni-site-url',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return renderSiteHtml(html, resolved)
      },
    },
    configureServer(server) {
      server.middlewares.use('/robots.txt', (_req, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(buildRobotsTxt(resolved))
      })
      server.middlewares.use('/sitemap.xml', (_req, res) => {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8')
        res.end(buildSitemapXml(resolved))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(resolved) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemapXml(resolved) })
    },
  }
}
