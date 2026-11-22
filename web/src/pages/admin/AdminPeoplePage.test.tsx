import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import type { AccessDirectory } from '../../lib/access'
import { AdminPeoplePage } from './AdminPeoplePage'

vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { isSuperAdmin: true, active: true } }) }))
vi.mock('../../lib/api', () => ({
  api: {
    adminPermissionGrants: vi.fn(),
    assignPermissionGrants: vi.fn(),
    revokePermissionScope: vi.fn(),
    updateUserAccess: vi.fn(),
  },
}))

const directory: AccessDirectory = {
  presets: [{ key: 'scorekeeper', label: 'Scorekeeper', scopeTypes: ['tournament'], grants: [{ capability: 'scores_and_stats', actions: ['view', 'edit', 'request_correction'] }] }],
  capabilities: { scores_and_stats: ['view', 'edit', 'request_correction', 'correct_final'] },
  tournaments: [{ id: '1', year: 2027, name: 'FD' }],
  campaigns: [],
  pendingInvites: [],
  activeSuperAdminCount: 1,
  users: [{
    id: '2', email: 'mara@example.test', fullName: 'Mara', active: true, superAdmin: false, campaignMemberships: [],
    grants: [{ id: '1', email: 'mara@example.test', scopeType: 'tournament', scopeId: '1',
      capability: 'scores_and_stats', actions: ['view', 'edit'], acceptedAt: '2027-01-01' }],
  }],
}

beforeEach(() => vi.mocked(api.adminPermissionGrants).mockResolvedValue(directory))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

it('prefills a preset, edits actions, and describes the scoped access', async () => {
  render(<AdminPeoplePage />)
  fireEvent.click(await screen.findByRole('button', { name: 'Scorekeeper' }))
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.test' } })
  fireEvent.change(screen.getByLabelText('Season or campaign'), { target: { value: '1' } })
  expect(screen.getByText('Mara can enter scores for the 2027 tournament.')).toBeTruthy()
  const actions = within(screen.getByRole('group', { name: 'Scores and stats' }))
  expect((actions.getByRole('checkbox', { name: 'Request corrections' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(actions.getByRole('checkbox', { name: 'Request corrections' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save access' }))
  await waitFor(() => expect(api.assignPermissionGrants).toHaveBeenCalledWith({
    email: 'mara@example.test', scopeType: 'tournament', scopeId: '1', presetKey: 'scorekeeper',
    grants: [{ capability: 'scores_and_stats', actions: ['view', 'edit'] }],
  }))
})

it('uses distinct actions and confirmation copy for removal and deactivation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<AdminPeoplePage />)
  fireEvent.click(await screen.findByRole('button', { name: /Remove this season/ }))
  await screen.findByText('Scoped access removed.')
  expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('Their account'))
  expect(api.revokePermissionScope).toHaveBeenCalledWith({ email: 'mara@example.test', scopeType: 'tournament', scopeId: '1' })
  expect(api.updateUserAccess).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }))
  await screen.findByText('Account status updated.')
  expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('blocks sign-in'))
  expect(api.updateUserAccess).toHaveBeenCalledWith('2', { active: false })
})
