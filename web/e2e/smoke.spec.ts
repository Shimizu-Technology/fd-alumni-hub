import { expect, test } from '@playwright/test'

function attachErrorCollectors(page: import('@playwright/test').Page, { ignoreOfflineNetwork = false } = {}) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (
      ignoreOfflineNetwork &&
      (text.includes('ERR_CONNECTION_REFUSED') ||
        text.includes('ERR_FAILED') ||
        text.includes('Failed to load resource') ||
        text.includes('NetworkError'))
    ) {
      return
    }
    consoleErrors.push(text)
  })

  return { pageErrors, consoleErrors }
}

const OFFLINE_ROUTES = [
  { path: '/', expectedHeading: /FD Alumni/i },
  { path: '/host-year', expectedHeading: /Host Year|Fundraisers/i },
  { path: '/schedule', expectedHeading: /Schedule/i },
  { path: '/standings', expectedHeading: /Standings/i },
  { path: '/tickets', expectedHeading: /Tournament Tickets/i },
  { path: '/sponsors', expectedHeading: /Tournament support/i },
  { path: '/history', expectedHeading: /Champion history|History/i },
]

test.describe('FD Alumni Hub smoke suite', () => {
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`offline routes and admin finance degrade cleanly (${viewport.name})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const { pageErrors, consoleErrors } = attachErrorCollectors(page, { ignoreOfflineNetwork: true })

      await page.route('**/health', (route) => route.abort('connectionrefused'))
      await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'))

      for (const { path, expectedHeading } of OFFLINE_ROUTES) {
        await page.goto(path, { waitUntil: 'domcontentloaded' })
        await expect(page.locator('.api-status-banner')).toContainText(
          'Live tournament services are currently paused or unreachable',
        )
        await expect(page.locator('main')).toContainText(expectedHeading)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `[${viewport.name}] horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
      }

      await page.goto('/admin/campaign/finance', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('body')).toContainText('Admin API unavailable')

      expect(pageErrors, `[${viewport.name}] page errors`).toEqual([])
      expect(consoleErrors, `[${viewport.name}] console errors`).toEqual([])
      await context.close()
    })
  }

  test('mobile bottom navigation meets touch targets, focus restoration, and footer clearance', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const { pageErrors, consoleErrors } = attachErrorCollectors(page, { ignoreOfflineNetwork: true })

    await page.route('**/health', (route) => route.abort('connectionrefused'))
    await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'))

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const nav = page.locator('nav.mobile-bottom-nav')
    await expect(nav).toBeVisible()

    const items = nav.locator('.mobile-bottom-nav-item')
    await expect(items).toHaveCount(5)

    const count = await items.count()
    for (let i = 0; i < count; i += 1) {
      const box = await items.nth(i).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }

    const moreButton = nav.getByRole('button', { name: /more menu/i })
    await moreButton.click()
    await expect(page.getByRole('dialog', { name: 'Site menu' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Site menu' })).toBeHidden()
    await expect(moreButton).toBeFocused()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const clearance = await page.evaluate(() => {
      const navRect = document.querySelector('nav.mobile-bottom-nav')?.getBoundingClientRect()
      const links = Array.from(document.querySelectorAll('footer a'))
      const maxLinkBottom = links.length ? Math.max(...links.map((el) => el.getBoundingClientRect().bottom)) : 0
      return { navTop: navRect?.top ?? 0, linkCount: links.length, maxLinkBottom }
    })
    expect(clearance.linkCount).toBeGreaterThan(0)
    expect(clearance.maxLinkBottom).toBeLessThanOrEqual(clearance.navTop + 1)

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })

  test('online mocked /host-year renders campaign meter and admin enforces auth gate', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    const { pageErrors, consoleErrors } = attachErrorCollectors(page)

    await page.route('**/health', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'text/plain',
        body: 'ok',
      }),
    )
    await page.route('**/api/v1/**', (route) =>
      route.fulfill({
        status: 404,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not mocked' }),
      }),
    )
    await page.route('**/api/v1/public/tournaments*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({ tournaments: [], activeTournament: null }),
      }),
    )
    await page.route('**/api/v1/public/host-year*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          campaign: {
            id: '1',
            slug: '2027-class-of-2017',
            title: 'Class of 2017 Host Year',
            tagline: 'Road to Summer 2027',
            description: 'Official fundraising hub.',
            status: 'active',
            featured: true,
            countdownTargetAt: '2027-06-25T08:00:00Z',
            countdownLabel: 'Tip-off 2027',
            heroImageUrl: null,
            donationUrl: 'https://example.org/donate',
            donationInstructions: null,
            golfUrl: 'https://fd-golf.shimizu-technology.com',
            tournament: { id: '1', name: 'FD Alumni Basketball Tournament', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'upcoming' },
            hostClass: { id: '1', key: '17', routeKey: '17', graduationYear: 2017, displayName: 'Class of 2017', shortLabel: "'17" },
            meter: { enabled: true, goalCents: 3000000, raisedCents: 540000, percent: 18, updatedAt: '2026-11-22T06:00:00Z' },
          },
          events: [],
          posts: [],
          hafapass: { available: false, stale: false, fetchedAt: null, allTicketsUrl: null, events: [] },
        }),
      }),
    )

    await page.goto('/host-year', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('Class of 2017 Host Year')
    await expect(page.locator('main')).toContainText('$5,400')

    await page.goto('/admin/campaign/finance', { waitUntil: 'domcontentloaded' })
    // CI builds without Clerk keys ("Access pending"); local builds with VITE_CLERK_PUBLISHABLE_KEY render sign-in gate
    await expect(page.locator('body')).toContainText(/Access pending|sign in/i)

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })

  test('online mocked /tickets renders stale badge fallback and swaps mobile bottom nav to Today when live', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const { pageErrors, consoleErrors } = attachErrorCollectors(page)

    await page.route('**/health', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'text/plain',
        body: 'ok',
      }),
    )
    await page.route('**/api/v1/public/tournaments*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [
            { id: '1', name: 'FD Alumni 2027', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'live' },
          ],
          activeTournament: { id: '1', name: 'FD Alumni 2027', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'live' },
        }),
      }),
    )
    await page.route('**/api/v1/public/tickets*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: { id: '1', name: 'FD Alumni 2027', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'live' },
          campaign: { slug: '2027-class-of-2017', title: 'Class of 2017 Host Year', allTicketsUrl: 'https://hafapass.shimizu-technology.com/go/fd2027' },
          hafapass: { available: true, stale: true, fetchedAt: '2027-06-25T05:00:00Z' },
          passes: [
            {
              id: 'pass-1',
              slug: 'fd-2027-pass',
              title: 'FD 2027 All-Tournament Pass',
              shortDescription: 'Entry for every night of tournament play.',
              startsAt: '2027-06-25T08:00:00Z',
              endsAt: null,
              venueName: 'FD Phoenix Center',
              venueCity: 'Mangilao',
              organizerSlug: 'fdaa-guam',
              isPass: true,
              seriesSlug: null,
              ticketState: null,
              minAllInPriceCents: null,
              ticketTypes: [],
              availabilityLabel: 'Check availability on HåfaPass',
              buyUrl: 'https://hafapass.shimizu-technology.com/go/fd2027',
            },
          ],
          gameNights: [],
          otherEvents: [],
          fundraiserEvents: [],
          doorInfo: {
            venue: 'Father Duenas Phoenix Center (Mangilao, Guam)',
            doorsOpenNote: 'Doors open 45 minutes before tip-off.',
            paymentNote: 'Digital and walk-up tickets available.',
            reentryNote: 'Keep your pass visible for re-entry.',
            tournamentYear: 2027,
          },
        }),
      }),
    )

    await page.goto('/tickets', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('FD 2027 All-Tournament Pass')
    await expect(page.locator('main')).toContainText('Check live availability on HåfaPass')
    await expect(page.locator('main')).toContainText('Door & admission info')

    const nav = page.locator('nav.mobile-bottom-nav')
    await expect(nav).toContainText('Today')
    await expect(nav).toContainText('Tickets')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })
})
