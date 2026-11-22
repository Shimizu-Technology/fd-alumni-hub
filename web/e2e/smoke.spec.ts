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

test.describe('FD Alumni Hub smoke suite', () => {
  test('public routes and admin finance degrade cleanly when API is offline (desktop & mobile)', async ({ browser }) => {
    for (const viewport of [
      { name: 'desktop', width: 1280, height: 800 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      const { pageErrors, consoleErrors } = attachErrorCollectors(page, { ignoreOfflineNetwork: true })

      await page.route('**/health', (route) => route.abort('connectionrefused'))
      await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'))

      for (const path of ['/', '/host-year', '/schedule', '/standings', '/history']) {
        await page.goto(path, { waitUntil: 'networkidle' })
        await expect(page.locator('body')).toContainText(/paused or unreachable|Champion history|Host Year|unavailable/i)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `[${viewport.name}] horizontal overflow on ${path}`).toBeLessThanOrEqual(1)
      }

      await page.goto('/admin/campaign/finance', { waitUntil: 'networkidle' })
      await expect(page.locator('body')).toContainText('Admin API unavailable')

      expect(pageErrors, `[${viewport.name}] page errors`).toEqual([])
      expect(consoleErrors, `[${viewport.name}] console errors`).toEqual([])
      await context.close()
    }
  })

  test('mobile bottom navigation meets touch targets, focus restoration, and footer clearance', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const { pageErrors, consoleErrors } = attachErrorCollectors(page, { ignoreOfflineNetwork: true })

    await page.route('**/health', (route) => route.abort('connectionrefused'))
    await page.route('**/api/v1/**', (route) => route.abort('connectionrefused'))

    await page.goto('/', { waitUntil: 'networkidle' })

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

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const clearance = await page.evaluate(() => {
      const navRect = document.querySelector('nav.mobile-bottom-nav')?.getBoundingClientRect()
      const links = Array.from(document.querySelectorAll('footer a'))
      const maxLinkBottom = Math.max(...links.map((el) => el.getBoundingClientRect().bottom))
      return { navTop: navRect?.top ?? 0, maxLinkBottom }
    })
    expect(clearance.maxLinkBottom).toBeLessThanOrEqual(clearance.navTop + 1)

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })

  test('online mocked /host-year renders campaign meter and admin fails closed without Clerk', async ({ browser }) => {
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

    await page.goto('/host-year', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText('Class of 2017 Host Year')
    await expect(page.locator('body')).toContainText('$5,400')

    await page.goto('/admin/campaign/finance', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toContainText('Access pending')

    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
    await context.close()
  })
})
