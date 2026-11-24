import { expect, test } from '@playwright/test'
import { offlineSiteMode } from '../src/lib/siteMode'
import { campaign, completedEvent, hafapass, hostYear, tournament, upcomingEvent } from '../src/test/fundraiserFixtures'

for (const width of [320, 390, 1440]) {
  test(`fundraising headquarters, detail links and recap lightbox at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const siteMode = { ...offlineSiteMode, tournament, sections: { ...offlineSiteMode.sections, fundraisers: true } }
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'x-fd-voter-token' }
    const detailEvent = {
      ...completedEvent,
      recapPhotos: [completedEvent.recapPhotos[0], {
        ...completedEvent.recapPhotos[1], caption: 'First tip-off '.repeat(4) + 'Alumni'.repeat(24),
      }],
    }
    const standaloneRequests: string[] = []
    await page.route('**/health', (route) => route.fulfill({ headers, body: 'ok' }))
    await page.route('https://images.example.com/**', (route) => route.fulfill({ path: 'public/brand/fd-crest.png' }))
    await page.route('**/api/v1/public/site-mode', (route) => route.fulfill({ headers, json: { siteMode, alerts: [] } }))
    await page.route('**/api/v1/public/home', (route) => route.fulfill({
      headers, json: { siteMode, tournament, hostYear, championRecords: [], todayGames: [], liveGames: [],
        latestNews: [], gameDayNote: null, predictionPolls: [], alerts: [] },
    }))
    await page.route('**/api/v1/public/host-year*', (route) => {
      standaloneRequests.push(route.request().url())
      return route.fulfill({ headers, json: hostYear })
    })
    await page.route('**/api/v1/public/fundraisers/20', (route) => route.fulfill({ headers, json: { event: upcomingEvent, campaign, hafapass } }))
    await page.route('**/api/v1/public/fundraisers/21', (route) => route.fulfill({ headers, json: { event: detailEvent, campaign, hafapass } }))

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Raised $4,200 of $30,000' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Class updates & recaps' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Find Your Class' })).toBeVisible()
    expect(standaloneRequests).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

    await page.getByRole('link', { name: 'View recap & photos' }).click()
    await expect(page).toHaveURL(/\/fundraisers\/21$/)
    await expect(page.getByRole('heading', { name: 'Event Recap' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buy tickets' })).toHaveCount(0)
    const photo = page.getByRole('button', { name: /Open recap photo 1/ })
    await photo.click()
    const dialog = page.getByRole('dialog', { name: 'Recap Photo Gallery' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(dialog).toContainText(detailEvent.recapPhotos[1].caption!)
    expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    const bounds = await dialog.boundingBox()
    expect(bounds?.x).toBeGreaterThanOrEqual(0)
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width)
    await dialog.getByRole('button', { name: 'Next' }).click()
    await expect(dialog).toContainText('The team')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(photo).toBeFocused()
    await page.getByRole('link', { name: /Back to fundraisers/ }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole('link', { name: 'Event details' }).click()
    await expect(page).toHaveURL(/\/fundraisers\/20$/)
    await expect(page.getByRole('img', { name: 'Flyer for Alumni dinner' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Buy tickets' })).toHaveAttribute('href', 'https://example.com/tickets')

    await page.goto('/host-year/alumni-host-year')
    await expect(page.getByRole('link', { name: 'View recap & photos' })).toHaveAttribute('href', '/fundraisers/21')
    await page.goto('/host-year/events/21')
    await expect(page.getByRole('heading', { name: 'Event Recap' })).toBeVisible()
  })
}
