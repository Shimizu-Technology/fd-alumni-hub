import { describe, expect, it } from 'vitest'
import { canOpenAdminRoute, defaultWorkspaceHome, hasCapability, visibleAdminModules } from '../adminModules'
import type { CurrentUser } from '../types'

const duty = (capability: string, actions = ['view']) => ({ capability, actions, scopeType: 'tournament', scopeIds: ['1'], allScopes: false })
const userWith = (...capabilities: ReturnType<typeof duty>[]) => ({ active: true, capabilities }) as CurrentUser

describe('admin workspace access', () => {
  it.each([
    ['scores_and_stats', '/admin/scorekeeper'],
    ['finance_and_reimbursements', '/admin/campaign/finance'],
    ['tonights_menu_and_news', '/admin/game-day'],
    ['fundraisers_and_sponsors', '/admin/campaign/host-year'],
  ])('opens the %s workspace directly', (capability, path) => {
    const user = userWith(duty(capability))
    expect(defaultWorkspaceHome(user)).toBe(path)
    expect(visibleAdminModules(user).map((module) => module.path)).toEqual([path])
    expect(canOpenAdminRoute(user, '/admin/people')).toBe(false)
  })

  it('lands a board viewer in finance with the linked audit workspace', () => {
    const user = userWith(duty('finance_and_reimbursements'), duty('fundraisers_and_sponsors'), duty('view_audit_log'))
    expect(defaultWorkspaceHome(user)).toBe('/admin/campaign/finance')
    expect(visibleAdminModules(user).map((module) => module.key)).toEqual(['campaign/host-year', 'campaign/finance', 'audit'])
    expect(hasCapability(user, 'finance_and_reimbursements', 'record')).toBe(false)
  })

  it('lands a Host Class Chair directly in Host Year instead of Finance and hides All Campaigns tab', () => {
    const chair = userWith(
      { capability: 'fundraisers_and_sponsors', actions: ['view', 'edit'], scopeType: 'campaign', scopeIds: ['1'], allScopes: false },
      { capability: 'finance_and_reimbursements', actions: ['view', 'approve'], scopeType: 'campaign', scopeIds: ['1'], allScopes: false },
    )
    expect(defaultWorkspaceHome(chair)).toBe('/admin/campaign/host-year')
    expect(canOpenAdminRoute(chair, '/admin/campaigns')).toBe(false)
  })

  it('gives mixed tournament duties and Super Admins a My work landing', () => {
    const mixed = userWith(duty('scores_and_stats', ['view', 'edit']), duty('tonights_menu_and_news'))
    expect(defaultWorkspaceHome(mixed)).toBe('/admin')
    expect(visibleAdminModules(mixed).map((module) => module.key)).toEqual(['work', 'game-day', 'scorekeeper'])
    expect(hasCapability(mixed, 'scores_and_stats', 'edit', { type: 'tournament', id: '2' })).toBe(false)
    const admin = { ...userWith(), isSuperAdmin: true }
    expect(defaultWorkspaceHome(admin)).toBe('/admin')
    expect(visibleAdminModules(admin).map((module) => module.key)).toContain('site-mode')
  })

  it('opens Site Mode only for site-level view access', () => {
    const scoped = userWith(duty('site_mode_and_settings'))
    const site = userWith({ ...duty('site_mode_and_settings'), scopeType: 'site', scopeIds: [], allScopes: true })
    expect(canOpenAdminRoute(scoped, '/admin/site-mode')).toBe(false)
    expect(canOpenAdminRoute(site, '/admin/site-mode')).toBe(true)
    expect(defaultWorkspaceHome(site)).toBe('/admin/site-mode')
  })

  it('authorizes tournament detail routes against the path tournament ID', () => {
    const editor = userWith(duty('schedule_and_teams', ['view', 'edit']))
    expect(canOpenAdminRoute(editor, '/admin/tournaments/1')).toBe(true)
    expect(canOpenAdminRoute(editor, '/admin/tournaments/2')).toBe(false)
    expect(canOpenAdminRoute(editor, '/admin/tournaments/2', '1')).toBe(false)
  })
})
