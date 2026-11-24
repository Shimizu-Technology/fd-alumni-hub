import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SeoManager, seoForPath } from '../SeoManager'

describe('SeoManager', () => {
  const publicPaths = [
    '/',
    '/host-year',
    '/host-year/co2017-host-year',
    '/host-year/events/1',
    '/fundraisers/1',
    '/today',
    '/schedule',
    '/bracket',
    '/standings',
    '/tickets',
    '/watch',
    '/news',
    '/gallery',
    '/history',
    '/history/2026',
    '/classes/2017',
    '/teams',
    '/teams/42',
    '/sponsors',
    '/info',
  ]

  it('provides indexable titles for every active public route', () => {
    for (const path of publicPaths) {
      const seo = seoForPath(path)
      expect(seo.title, `Unexpected fallback title for ${path}`).not.toContain('Page unavailable')
      expect(seo.robots, `Unexpected noindex for ${path}`).toBeUndefined()
    }
  })

  it('marks admin and unknown routes noindex', () => {
    expect(seoForPath('/admin').robots).toBe('noindex,nofollow')
    expect(seoForPath('/admin/campaign/finance').robots).toBe('noindex,nofollow')
    expect(seoForPath('/does-not-exist').title).toContain('Page unavailable')
    expect(seoForPath('/does-not-exist').robots).toBe('noindex,nofollow')
  })

  it('sets document.title and robots meta when rendered on /fundraisers/1', () => {
    render(
      <MemoryRouter initialEntries={['/fundraisers/1']}>
        <SeoManager />
      </MemoryRouter>,
    )
    expect(document.title).toBe('Host Year Fundraiser | FD Alumni Basketball Hub')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
  })
})
