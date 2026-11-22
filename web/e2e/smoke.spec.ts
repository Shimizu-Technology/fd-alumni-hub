import { expect, test } from '@playwright/test'
import { offlineSiteMode } from '../src/lib/siteMode'

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
  { path: '/bracket', expectedHeading: /Playoff bracket/i },
  { path: '/standings', expectedHeading: /Standings/i },
  { path: '/tickets', expectedHeading: /Tournament Tickets/i },
  { path: '/info', expectedHeading: /Venue & Rules/i },
  { path: '/sponsors', expectedHeading: /Tournament support/i },
  { path: '/teams', expectedHeading: /Teams & Rosters/i },
  { path: '/unknown-page', expectedHeading: /Page not found/i },
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
    await expect(items).toHaveCount(4)

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
    await page.route('**/api/v1/public/site-mode', (route) =>
      route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { siteMode: offlineSiteMode, alerts: [] } }),
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

  test('online mocked /tickets renders stale badge fallback and switches mobile navigation to Tonight when live', async ({ browser }) => {
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
    await page.route('**/api/v1/public/site-mode', (route) => {
      const links = [{ to: '/today', label: 'Tonight' }, { to: '/schedule', label: 'Schedule' }, { to: '/tickets', label: 'Tickets' }]
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { siteMode: { ...offlineSiteMode, mode: 'tournament_live', navItems: links, mobileBottomNav: [...links, { to: null, label: 'More' }] }, alerts: [] },
      })
    })
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
    await expect(nav).toContainText('Tonight')
    await expect(nav).toContainText('Tickets')

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })

  test('online mocked /bracket and /today render storm alert banner, mobile round switcher, scores, and delay note', async ({ browser }) => {
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
    await page.route('**/api/v1/public/site-mode', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          siteMode: { ...offlineSiteMode, mode: 'tournament_live' },
          alerts: [
            {
              id: 'alert-1',
              tournamentId: '1',
              severity: 'urgent',
              title: 'Typhoon Delay',
              message: 'Tip-off moved back 1 hour due to heavy rain.',
              active: true,
              startsAt: null,
              expiresAt: null,
            },
          ],
        }),
      }),
    )
    await page.route('**/api/v1/public/bracket*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: { id: '1', name: 'FD Alumni 2027', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'live' },
          divisions: [
            {
              division: { id: '10', name: 'Maroon', slug: 'maroon', position: 1 },
              rounds: [
                {
                  round: 'quarterfinal',
                  label: 'Quarterfinals',
                  games: [
                    {
                      id: '101',
                      tournamentId: '1',
                      homeTeamId: '1',
                      awayTeamId: '2',
                      startTime: '2027-07-12T09:00:00Z',
                      venue: 'FD Phoenix Center',
                      status: 'final',
                      phase: 'playoff',
                      bracketCode: 'MQF1',
                      bracketRound: 'quarterfinal',
                      bracketSlot: 1,
                      homeScore: 81,
                      awayScore: 73,
                      streamUrl: null,
                      ticketUrl: null,
                      notes: null,
                      division: 'Maroon',
                      homeTeam: { id: '1', displayName: 'Class of 2017', classYearLabel: '2017', classCohorts: [], division: 'Maroon' },
                      awayTeam: { id: '2', displayName: 'Class of 2018', classYearLabel: '2018', classCohorts: [], division: 'Maroon' },
                    },
                  ],
                },
                {
                  round: 'semifinal',
                  label: 'Semifinals',
                  games: [
                    {
                      id: '102',
                      tournamentId: '1',
                      homeTeamId: '1',
                      awayTeamId: '3',
                      startTime: '2027-07-14T09:00:00Z',
                      venue: 'FD Phoenix Center',
                      status: 'scheduled',
                      phase: 'playoff',
                      bracketCode: 'MSF1',
                      bracketRound: 'semifinal',
                      bracketSlot: 1,
                      homeScore: null,
                      awayScore: null,
                      streamUrl: null,
                      ticketUrl: null,
                      notes: null,
                      division: 'Maroon',
                      placeholder: true,
                      homeTeam: { id: '1', displayName: 'Class of 2017', classYearLabel: '2017', classCohorts: [], division: 'Maroon' },
                      awayTeam: { id: '3', displayName: 'Winner MQF2', classYearLabel: 'WMQF2', classCohorts: [], division: 'Maroon' },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      }),
    )
    await page.route('**/api/v1/public/today*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: { id: '1', name: 'FD Alumni 2027', year: 2027, startDate: '2027-06-25', endDate: '2027-07-16', status: 'live' },
          date: '2027-07-12',
          gameDayNote: null,
          alerts: [],
          fallbackTicketUrl: 'https://hafapass.shimizu-technology.com/go/fd2027',
          games: [
            {
              id: '201',
              tournamentId: '1',
              homeTeamId: '1',
              awayTeamId: '2',
              startTime: '2027-07-12T09:00:00Z',
              venue: 'FD Phoenix Center',
              status: 'delayed',
              statusNote: 'Delayed 60 minutes due to power flicker',
              homeScore: 42,
              awayScore: 39,
              streamUrl: null,
              ticketUrl: null,
              notes: null,
              division: 'Maroon',
              bracketCode: null,
              homeTeam: { id: '1', displayName: 'Class of 2017', classYearLabel: '2017', classCohorts: [], division: 'Maroon' },
              awayTeam: { id: '2', displayName: 'Class of 2018', classYearLabel: '2018', classCohorts: [], division: 'Maroon' },
            },
          ],
          predictionPolls: [],
          sponsors: [],
          lastUpdatedAt: '2027-07-12T09:05:00Z',
        }),
      }),
    )

    await page.goto('/bracket', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('alert')).toContainText('Typhoon Delay')
    const mobileRound = page.locator('.bracket-mobile-round')
    await expect(mobileRound).toBeVisible()
    await expect(mobileRound).toContainText('Class of 2017')
    await expect(mobileRound).not.toContainText('Winner MQF2')
    await page.getByRole('button', { name: /Semifinals/i }).click()
    await expect(mobileRound).toContainText('Winner MQF2')
    const bracketOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(bracketOverflow).toBeLessThanOrEqual(1)

    await page.goto('/today', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main')).toContainText('39 – 42')
    await expect(page.locator('main')).toContainText('Delayed 60 minutes due to power flicker')
    await expect(page.locator('main')).toContainText('Tournament tickets')
    const todayOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(todayOverflow).toBeLessThanOrEqual(1)

    await page.route('**/api/v1/public/today?**', (route) => {
      const date = new URL(route.request().url()).searchParams.get('date')
      const restDay = date === '2027-07-11'
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          date, requestedDate: date, resolvedDate: date, isRestDay: restDay,
          nextScheduledDate: restDay ? '2027-07-12' : null,
          games: [], predictionPolls: [], linkedCampaignEvents: [], updates: [],
          gameDayNote: { menuItems: restDay ? [] : [{ name: 'BBQ plate', price: '$12', available: false }] },
        },
      })
    })
    await page.getByLabel('Guam date').fill('2027-07-11')
    await expect(page.getByRole('heading', { name: 'Rest day at The Jungle' })).toBeVisible()
    await page.getByRole('button', { name: /Next scheduled night/ }).click()
    await expect(page).toHaveURL(/date=2027-07-12/)
    await expect(page.getByText('BBQ plate')).toBeVisible()
    await expect(page.getByText('Sold out')).toBeVisible()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('Guam date')).toHaveValue('2027-07-12')
    await expect(page.getByText('BBQ plate')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)


    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })
})

test('published teams can be searched, filtered and opened from the desktop season navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  const tournament = { id: '1', year: 2027, name: 'Alumni Tournament', startDate: '2027-07-03', endDate: '2027-07-24', status: 'upcoming' }
  const links = [
    { label: 'Home', to: '/' }, { label: 'Schedule', to: '/schedule' }, { label: 'Teams', to: '/teams' },
    { label: 'Tickets', to: '/tickets' }, { label: 'History', to: '/history' },
  ]
  const siteMode = { ...offlineSiteMode, tournament, mode: 'schedule_ready', navItems: links, schedulePublished: true }
  const classCohort = { id: '1', key: '16', routeKey: '16', displayName: 'Class of 2016', graduationYear: 2016, shortLabel: "'16" }
  const team = { id: '1', tournamentId: tournament.id, displayName: 'Class of 2016', classYearLabel: '2016', division: 'Maroon', classCohorts: [classCohort] }
  const other = { id: '2', tournamentId: tournament.id, displayName: 'Class of 2018', classYearLabel: '2018', division: 'Gold', classCohorts: [] }
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'x-fd-voter-token' }
  await page.route('**/health', (route) => route.fulfill({ headers, body: 'ok' }))
  await page.route('**/api/v1/public/home', (route) => route.fulfill({
    headers,
    json: { siteMode, tournament, championRecords: [], todayGames: [], liveGames: [], latestNews: [], gameDayNote: null, predictionPolls: [], alerts: [] },
  }))
  await page.route('**/api/v1/public/teams', (route) => route.fulfill({
    headers, json: { tournament, teams: [team, other], divisions: ['Gold', 'Maroon'], schedulePublished: true },
  }))
  await page.route('**/api/v1/public/teams/1', (route) => route.fulfill({
    headers, json: { tournament, team, standing: null, games: [], articles: [], titleRecords: [] },
  }))
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(nav.getByRole('link')).toHaveCount(5)
  await nav.getByRole('link', { name: 'Teams', exact: true }).click()
  await expect(page.getByRole('heading', { name: '2027 Teams & Rosters' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search teams' }).fill('2018')
  await expect(page.locator('main').getByRole('link', { name: 'Class of 2018' })).toBeVisible()
  await expect(page.locator('main').getByRole('link', { name: 'Class of 2016' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search teams' }).clear()
  await page.getByLabel('Division').selectOption('Maroon')
  await expect(page.locator('main').getByRole('link', { name: 'Class of 2018' })).toHaveCount(0)
  await expect(page.locator('a[href="/classes/16"]')).toBeVisible()
  await page.locator('a[href="/teams/1"]').click()
  await expect(page.getByRole('heading', { name: 'Class of 2016', level: 1 })).toBeVisible()
})
