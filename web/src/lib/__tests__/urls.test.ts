import { describe, expect, it } from 'vitest'
import { externalHref, normalizeHttpsInput, safeHttpsHref } from '../urls'

describe('urls helpers', () => {
  it('normalizes valid external http/https URLs and bare domains', () => {
    expect(externalHref('https://fatherduenas.com/path')).toBe('https://fatherduenas.com/path')
    expect(externalHref('http://example.com')).toBe('http://example.com')
    expect(externalHref('//cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(externalHref('hafapass.shimizu-technology.com')).toBe('https://hafapass.shimizu-technology.com')
  })

  it('rejects javascript:, data:, mailto:, and empty URLs in externalHref', () => {
    expect(externalHref('')).toBeNull()
    expect(externalHref('   ')).toBeNull()
    expect(externalHref(null)).toBeNull()
    expect(externalHref('javascript:alert(1)')).toBeNull()
    expect(externalHref('JAVASCRIPT:alert(1)')).toBeNull()
    expect(externalHref('data:text/html,<script>alert(1)</script>')).toBeNull()
  })

  it('enforces https and blocks userinfo phishing in safeHttpsHref', () => {
    expect(safeHttpsHref('https://bucket.s3.ap-southeast-2.amazonaws.com/receipts/1/a.pdf')).toBe(
      'https://bucket.s3.ap-southeast-2.amazonaws.com/receipts/1/a.pdf',
    )
    expect(safeHttpsHref('https://trusted.com@evil.example/a.pdf')).toBeNull()
    expect(safeHttpsHref('https://user:pass@evil.example/a.pdf')).toBeNull()
    expect(safeHttpsHref('http://evil.example/a.pdf')).toBeNull()
    expect(safeHttpsHref('javascript:alert(1)')).toBeNull()
    expect(safeHttpsHref('not a url')).toBeNull()
  })

  it('auto-upgrades bare domains and http:// in normalizeHttpsInput while rejecting unsafe protocols', () => {
    expect(normalizeHttpsInput('')).toEqual({ ok: true, url: null })
    expect(normalizeHttpsInput('guamtime.net/events/fd')).toEqual({ ok: true, url: 'https://guamtime.net/events/fd' })
    expect(normalizeHttpsInput('http://guamtime.net/events/fd')).toEqual({ ok: true, url: 'https://guamtime.net/events/fd' })
    expect(normalizeHttpsInput('//clutchguam.com/live')).toEqual({ ok: true, url: 'https://clutchguam.com/live' })
    expect(normalizeHttpsInput('javascript:alert(1)', 'Ticket URL')).toEqual({
      ok: false,
      error: 'Ticket URL must be a valid https:// URL',
    })
    expect(normalizeHttpsInput('https://user:pass@evil.example/', 'Stream URL')).toEqual({
      ok: false,
      error: 'Stream URL must be a valid https:// URL',
    })
  })
})
