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
  fireEvent.click(await screen.findByRole('button', { name: /^Scorekeeper/ }))
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'mara@example.test' } })
  fireEvent.change(screen.getByLabelText('Season or campaign'), { target: { value: '1' } })
  expect(screen.getByText('Mara can enter scores for the 2027 tournament.')).toBeTruthy()
  const customize = screen.getByText('Customize individual permissions')
  expect(customize.closest('details')).not.toHaveAttribute('open')
  fireEvent.click(customize)
  expect(customize.closest('details')).toHaveAttribute('open')
  const actions = within(screen.getByRole('group', { name: 'Scores and stats' }))
  expect((actions.getByRole('checkbox', { name: 'Request corrections' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(actions.getByRole('checkbox', { name: 'Request corrections' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save access' }))
  await waitFor(() => expect(api.assignPermissionGrants).toHaveBeenCalledWith({
    email: 'mara@example.test', scopeType: 'tournament', scopeId: '1', presetKey: 'scorekeeper',
    grants: [{ capability: 'scores_and_stats', actions: ['view', 'edit'] }],
  }))
})

it('uses distinct actions and themed confirmation dialogs for removal and deactivation', async () => {
  render(<AdminPeoplePage />)
  fireEvent.click(await screen.findByRole('button', { name: /Remove this season/ }))
  const removeDialog = await screen.findByRole('alertdialog', { name: 'Remove scoped access?' })
  expect(within(removeDialog).getByText(/Their account/)).toBeInTheDocument()
  fireEvent.click(within(removeDialog).getByRole('button', { name: 'Remove access' }))
  await screen.findByText('Scoped access removed.')
  expect(api.revokePermissionScope).toHaveBeenCalledWith({ email: 'mara@example.test', scopeType: 'tournament', scopeId: '1' })
  expect(api.updateUserAccess).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate account' }))
  const deactivateDialog = await screen.findByRole('alertdialog', { name: 'Deactivate account?' })
  expect(within(deactivateDialog).getByText(/blocks sign-in/)).toBeInTheDocument()
  fireEvent.click(within(deactivateDialog).getByRole('button', { name: 'Deactivate account' }))
  await screen.findByText('Account status updated.')
  expect(api.updateUserAccess).toHaveBeenCalledWith('2', { active: false })
})

it('auto-selects a single campaign on preset click and copies WhatsApp invite instructions for pending users', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  vi.mocked(api.adminPermissionGrants).mockResolvedValue({
    ...directory,
    presets: [
      { key: 'class_chair', label: 'Class Chair', scopeTypes: ['campaign'], grants: [{ capability: 'fundraisers_and_sponsors', actions: ['view', 'edit', 'publish'] }] },
    ],
    campaigns: [{ id: '7', title: 'Class of 2017 Host Year' }],
    pendingInvites: [{
      id: '9', email: 'jhulian@example.test', scopeType: 'campaign', scopeId: '7',
      capability: 'fundraisers_and_sponsors', actions: ['view', 'edit', 'publish'], acceptedAt: null,
    }],
  })
  render(<AdminPeoplePage />)
  fireEvent.click(await screen.findByRole('button', { name: /^Host Class Chair/ }))
  expect(screen.getByLabelText('Season or campaign')).toHaveValue('7')
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'rico@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save access' }))
  expect(await screen.findByRole('status')).toHaveTextContent(/No email is sent automatically/i)
  const copyButtons = screen.getAllByRole('button', { name: 'Copy WhatsApp invite' })
  fireEvent.click(copyButtons[0])
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('rico@example.test')))
  expect(await screen.findByRole('button', { name: 'Copied invite!' })).toBeInTheDocument()
})
