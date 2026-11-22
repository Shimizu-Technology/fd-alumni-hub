import { describe, expect, it } from 'vitest'
import { externalHref, safeHttpsHref } from '../urls'

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
})
