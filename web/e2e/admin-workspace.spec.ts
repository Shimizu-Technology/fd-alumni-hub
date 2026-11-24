import { expect, test } from '@playwright/test'
import { build } from 'vite'
import { offlineSiteMode } from '../src/lib/siteMode'
import { adminCampaign, adminEvent, tournament } from '../src/test/fundraiserFixtures'

const origin = 'http://admin.fd.test'
const campaignPath = `/campaign/${adminCampaign.slug}`
const date = '2090-07-01'
const line = { id: '1', kind: 'expense', category: 'Gym rental', budgetCents: 150_000, actualCents: 0, varianceCents: -150_000 }
const siteMode = { ...offlineSiteMode, tournament }
const user = {
  id: '1', fullName: 'Test Organizer', firstName: 'Test', lastName: 'Organizer', email: 'organizer@example.test',
  active: true, role: 'admin', isAdmin: true, isSuperAdmin: true,
}

const fixtures: Record<string, unknown> = {
  '/me': { user },
  '/public/site-mode': { siteMode, alerts: [] },
  '/admin/dashboard': { tournament, counts: { teams: 16, games: 32 }, missing: { scores: 1, streams: 2, tickets: 3 }, recentArticles: [] },
  '/admin/tournaments': { tournaments: [tournament] },
  '/admin/tournaments/1': { tournament },
  '/admin/teams': { teams: [] },
  '/admin/games': { games: [], availableDates: [date], requestedDate: null, nextScheduledDate: date, pendingCorrectionCount: 0 },
  '/admin/divisions': { divisions: [], allDivisions: [] },
  '/admin/class-cohorts': { classCohorts: [] },
  '/admin/standings': { tournament, standings: [], scoreCoverage: { scoredGames: 0, totalGames: 0, percent: 0 } },
  '/admin/links': { tournament, games: [] },
  '/admin/missing-links': { tournament, summary: { missingTickets: 0, missingStreams: 0, missingScores: 0 } },
  '/admin/articles': { articles: [] },
  '/admin/media-assets': { mediaAssets: [] },
  '/admin/content-ingest-items': { ingestItems: [] },
  '/admin/sponsors': { sponsors: [] },
  '/admin/score-correction-requests': { correctionRequests: [] },
  '/admin/tournament-updates': { updates: [] },
  '/admin/alerts': { alerts: [] },
  '/admin/game-day-notes': {
    tournament, date, gameDayNote: null, games: [], predictionPolls: [], scheduledDates: [date],
    infoGuide: {
      venueName: 'Phoenix Center', venueAddress: '', ticketSourceName: 'HåfaPass', ticketSourceUrl: '/tickets', ticketSummary: '',
      doorInfo: '', eligibilityHighlights: [], gameRuleHighlights: [], conductHighlights: [], bylawDisclaimer: '',
    },
  },
  '/admin/campaigns': { campaigns: [adminCampaign] },
  [`${campaignPath}/settings`]: { campaign: adminCampaign, roles: ['chair'] },
  [`${campaignPath}/events`]: { events: [adminEvent] },
  [`${campaignPath}/posts`]: { posts: [] },
  [`${campaignPath}/finance/summary`]: {
    campaign: adminCampaign, roles: ['treasurer'],
    summary: {
      goalCents: 3_000_000, raisedCents: 420_000, raisedExcludingFdaaCents: 420_000, spentCents: 0, netCents: 420_000,
      stillNeededCents: 2_580_000, bySource: [], byMethod: [], budgetVsActual: [line], pendingReimbursementsCount: 0, mixedNetEventIds: [],
    },
  },
  [`${campaignPath}/budget-lines`]: { budgetLines: [line] },
  [`${campaignPath}/pledges`]: {
    pledges: [{ id: '1', donorName: 'Court Restoration Community Sponsor', tier: 'Gold', status: 'promised', promisedCents: 250_000, receivedCents: 0, outstandingCents: 250_000 }],
    sponsors: [],
  },
  [`${campaignPath}/ledger-entries`]: { ledgerEntries: [], options: { budgetLines: [line], events: [adminEvent], pledges: [], sponsors: [], members: [] } },
  '/admin/site-mode': { current: null, siteMode, tournaments: [tournament], campaigns: [adminCampaign], actions: ['publish'], history: [], suggestedMode: 'fundraising' },
  '/admin/site-mode/preview': { previewSiteMode: siteMode, changes: { appearing: [], disappearing: [] }, warnings: [] },
  '/admin/permission_grants': {
    presets: [{ key: 'scorekeeper', label: 'Scorekeeper', scopeTypes: ['tournament'], grants: [{ capability: 'scores_and_stats', actions: ['view', 'edit'] }] }],
    capabilities: { scores_and_stats: ['view', 'edit', 'request_correction'] },
    tournaments: [tournament], campaigns: [adminCampaign], pendingInvites: [], activeSuperAdminCount: 1, users: [],
  },
  '/admin/audit_events': { auditEvents: [], nextCursor: null, filterOptions: { areas: ['finance'], actors: [], tournaments: [], campaigns: [] } },
}

const routes = [
  '', '/campaign/host-year?tab=events', '/campaign/finance', '/game-day?date=' + date,
  '/games', '/scorekeeper', '/news', '/site-mode', '/people', '/audit',
  '/tournaments', '/tournaments/setup', '/tournaments/1', '/import', '/standings', '/divisions',
  '/links', '/missing-links', '/media', '/sponsors', '/campaigns', '/ingest',
]

let assets: Map<string, { contentType: string; body: string }>
let html: string

test.use({ serviceWorkers: 'block' })

test.beforeAll(async () => {
  // Build the real router and console with a Clerk fixture isolated from the shipped app.
  const result = await build({
    configFile: false,
    envFile: false,
    publicDir: false,
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify('pk_test_browser_fixture'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(`${origin}/api/v1`),
    },
    plugins: [{
      name: 'admin-clerk-fixture',
      enforce: 'pre',
      resolveId: (id) => id === '@clerk/clerk-react' ? '\0clerk-fixture' : undefined,
      load: (id) => id === '\0clerk-fixture' ? `
        const auth = { isLoaded: true, isSignedIn: true, getToken: async () => 'fixture' }
        const user = { user: { id: 'fixture' } }
        export const useAuth = () => auth
        export const useUser = () => user
        export const ClerkProvider = ({ children }) => children
        export const SignInButton = ClerkProvider
        export const SignOutButton = ClerkProvider
      ` : undefined,
    }],
    build: { write: false, rollupOptions: { input: 'src/main.tsx' } },
  })
  if (!('output' in result)) throw new Error('Admin fixture build did not return its assets.')
  assets = new Map()
  const tags = []
  for (const file of result.output) {
    const path = `/${file.fileName}`
    if (file.type === 'chunk') {
      assets.set(path, { body: file.code, contentType: 'text/javascript' })
      if (file.isEntry) tags.push(`<script type="module" src="${path}"></script>`)
    } else if (typeof file.source === 'string' && path.endsWith('.css')) {
      assets.set(path, { body: file.source, contentType: 'text/css' })
      tags.push(`<link rel="stylesheet" href="${path}">`)
    }
  }
  html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${tags.join('')}<div id="root"></div></html>`
})

for (const width of [320, 390, 1440]) {
  test(`authenticated admin routes and editors fit ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 840 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) return route.abort()
      if (url.pathname === '/health') return route.fulfill({ json: { status: 'ok' } })
      if (url.pathname.startsWith('/api/v1/')) {
        const resource = url.pathname.slice('/api/v1'.length)
        if (resource in fixtures) return route.fulfill({ json: fixtures[resource] })
        errors.push(`Missing mock for ${resource}`)
        return route.fulfill({ status: 404, json: { error: 'Missing fixture' } })
      }
      const asset = assets.get(url.pathname)
      if (asset) return route.fulfill(asset)
      if (route.request().resourceType() !== 'document') return route.fulfill({ status: 204 })
      return route.fulfill({ body: html, contentType: 'text/html' })
    })

    const fits = async (label: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, label).toBe(0)
    }
    const open = async (path: string) => {
      await page.goto(`${origin}/admin${path}`)
      await expect(page.locator('.admin-content h1').first(), errors.join(' · ')).toBeVisible()
      await fits(path || '/admin')
    }
    const checkEditor = async (action: string, title = action) => {
      const button = page.getByRole('button', { name: action, exact: true })
      await button.click()
      const dialog = page.getByRole('dialog', { name: title })
      await expect(dialog).toBeVisible()
      const horizontalOverflow = await dialog.evaluate((element) => ({
        scroll: element.scrollWidth - element.clientWidth,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right - innerWidth,
      }))
      expect(horizontalOverflow.scroll, title).toBe(0)
      expect(horizontalOverflow.left, title).toBeGreaterThanOrEqual(0)
      expect(horizontalOverflow.right, title).toBeLessThanOrEqual(0)
      await fits(title)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(button).toBeFocused()
    }

    for (const path of routes) await test.step(path || '/admin', () => open(path))

    await open('/campaign/finance')
    await checkEditor('Record money received')
    await checkEditor('Record expense')
    await page.getByRole('button', { name: /^Budget/ }).click()
    await expect(page.getByRole('table', { name: 'Budget vs Actual' })).toBeVisible()
    await fits('Budget table')
    await checkEditor('Add budget line')
    await page.getByRole('button', { name: /^Pledges/ }).click()
    await expect(page.getByRole('table', { name: 'Pledges' })).toBeVisible()
    await fits('Pledge table')
    await checkEditor('Add pledge')

    await open('/campaign/host-year?tab=events')
    await checkEditor('Add fundraiser')
    await checkEditor('Add Recap & Photos', 'Recap & photos for Alumni night')
    if (width < 700) await checkEditor('Open admin navigation', 'Admin navigation')

    await open('/game-day?date=' + date)
    await page.getByRole('button', { name: 'Add menu item' }).click()
    await page.getByLabel('Item name').fill('Iced tea')
    for (const section of ['Photos & Flyers', 'Events & Updates', 'Alerts & Guide', 'Menu & Spotlight']) {
      await page.getByRole('tab', { name: section }).click()
      await fits(section)
    }
    await expect(page.getByLabel('Item name')).toHaveValue('Iced tea')
    expect(errors).toEqual([])
  })
}
