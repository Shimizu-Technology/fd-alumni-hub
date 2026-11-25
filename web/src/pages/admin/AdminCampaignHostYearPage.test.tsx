import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { uploadCampaignImage } from '../../lib/uploads'
import { adminCampaign, adminEvent } from '../../test/fundraiserFixtures'
import { AdminCampaignHostYearPage } from './AdminCampaignHostYearPage'

vi.mock('../../contexts/AuthContext', () => ({ useAuthContext: () => ({ user: { isSuperAdmin: true } }) }))
vi.mock('../../lib/uploads', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/uploads')>()),
  uploadCampaignImage: vi.fn(),
}))

async function open() {
  render(<MemoryRouter initialEntries={['/admin/campaign/host-year?tab=events']}><AdminCampaignHostYearPage /></MemoryRouter>)
  await screen.findByRole('heading', { name: /Campaign events/ })
}

beforeEach(() => {
  vi.spyOn(api, 'adminCampaignWorkspace').mockResolvedValue({ campaigns: [adminCampaign] })
  vi.spyOn(api, 'campaignSettings').mockResolvedValue({ campaign: adminCampaign, roles: ['chair'] })
  vi.spyOn(api, 'campaignEvents').mockResolvedValue({ events: [adminEvent] })
  vi.spyOn(api, 'campaignPosts').mockResolvedValue({ posts: [] })
  vi.mocked(uploadCampaignImage).mockImplementation(async ({ file }) => `https://images.example.com/${file.name}`)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(uploadCampaignImage).mockReset()
})

it('uploads, previews, replaces and removes a flyer and uses the stored status for edits', async () => {
  const create = vi.spyOn(api, 'campaignCreateEvent').mockResolvedValue({ event: adminEvent })
  const update = vi.spyOn(api, 'campaignUpdateEvent').mockResolvedValue({ event: adminEvent })
  await open()
  expect(screen.getByText('Auto-completed')).toBeInTheDocument()

  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add fundraiser' }))
  expect(screen.getByRole('dialog', { name: 'Add fundraiser' })).toBeInTheDocument()
  expect(screen.getByText(/Ticketing links & advanced options/i).closest('details')).not.toHaveAttribute('open')
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New fundraiser' } })
  const firstFlyer = new File(['flyer'], 'first.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Upload flyer image'), { target: { files: [firstFlyer] } })
  expect(await screen.findByRole('img', { name: 'Flyer preview' })).toHaveAttribute('src', 'https://images.example.com/first.png')
  expect(uploadCampaignImage).toHaveBeenCalledWith({ file: firstFlyer, campaignSlug: adminCampaign.slug })
  const secondFlyer = new File(['flyer'], 'new.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Replace flyer image'), { target: { files: [secondFlyer] } })
  await waitFor(() => expect(screen.getByRole('img', { name: 'Flyer preview' })).toHaveAttribute('src', 'https://images.example.com/new.png'))
  fireEvent.click(screen.getByRole('button', { name: 'Create event' }))
  await waitFor(() => expect(create).toHaveBeenCalledWith(adminCampaign.slug, expect.objectContaining({ imageUrl: 'https://images.example.com/new.png' })))

  vi.mocked(api.campaignEvents).mockResolvedValue({ events: [{ ...adminEvent, imageUrl: 'https://images.example.com/flyer.jpg' }] })
  fireEvent.click(screen.getByLabelText('Show archived'))
  await waitFor(() => expect(api.campaignEvents).toHaveBeenCalledWith(adminCampaign.slug, { includeArchived: true }))
  await act(async () => { await Promise.resolve() })
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('dialog', { name: 'Edit fundraiser' })).toBeInTheDocument()
  expect(screen.getByLabelText('Status')).toHaveValue('open')
  fireEvent.click(screen.getByRole('button', { name: 'Remove flyer' }))
  expect(screen.queryByRole('img', { name: 'Flyer preview' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'cancelled' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save event' }))
  await waitFor(() => expect(update).toHaveBeenCalledWith(adminCampaign.slug, adminEvent.id, expect.objectContaining({ status: 'cancelled', imageUrl: null })))
})

it('uploads multiple recap photos, preserves a successful partial upload, and saves captions and removals', async () => {
  const update = vi.spyOn(api, 'campaignUpdateEvent').mockImplementation(async (_slug, _id, fields) => {
    const event = { ...adminEvent, ...fields }
    vi.mocked(api.campaignEvents).mockResolvedValue({ events: [event] })
    return { event }
  })
  vi.mocked(uploadCampaignImage).mockRejectedValueOnce(new Error('Upload interrupted'))
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Add Recap & Photos' }))
  const dialog = screen.getByRole('dialog', { name: 'Recap & photos for Alumni night' })
  const form = within(dialog).getByRole('form', { name: 'Recap for Alumni night' })
  const recap = within(form)
  fireEvent.change(recap.getByLabelText('Amount raised'), { target: { value: '$4,200 raised' } })
  fireEvent.change(recap.getByLabelText('Recap notes'), { target: { value: 'Thank you!' } })
  fireEvent.change(recap.getByLabelText('Recap highlights'), { target: { value: 'Alumni scrimmage.' } })
  const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' })
  const second = new File(['second'], 'second.jpg', { type: 'image/jpeg' })
  const picker = recap.getByLabelText('Upload recap photos')
  expect(picker).toHaveAttribute('multiple')
  fireEvent.change(picker, { target: { files: [first, second] } })
  expect(await recap.findByRole('alert')).toHaveTextContent('Could not upload first.jpg')
  expect(recap.getByRole('img', { name: 'Recap photo 1 preview' })).toHaveAttribute('src', 'https://images.example.com/second.jpg')
  fireEvent.change(picker, { target: { files: [first] } })
  expect(await recap.findByRole('img', { name: 'Recap photo 2 preview' })).toHaveAttribute('src', 'https://images.example.com/first.jpg')
  fireEvent.click(recap.getByRole('button', { name: 'Remove photo 1' }))
  fireEvent.change(recap.getByLabelText('Caption for photo 1'), { target: { value: 'The team' } })
  fireEvent.click(recap.getByRole('button', { name: 'Save recap' }))
  expect(await recap.findByRole('status')).toHaveTextContent('Recap saved.')
  expect(recap.getByRole('link', { name: /View public recap/i })).toHaveAttribute('href', `/fundraisers/${adminEvent.id}`)
  expect(update).toHaveBeenCalledWith(adminCampaign.slug, adminEvent.id, {
    recapNotes: 'Thank you!', recapHighlights: 'Alumni scrimmage.', raisedDisplay: '$4,200 raised',
    recapPhotos: [{ url: 'https://images.example.com/first.jpg', caption: 'The team' }],
  })
  fireEvent.click(recap.getByRole('button', { name: 'Close recap editor' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Recap & Photos' }))
  expect(screen.getByLabelText('Caption for photo 1')).toHaveValue('The team')
})

it('disables parent recap toggle and archive buttons while a recap upload is in flight', async () => {
  let resolveUpload!: (url: string) => void
  vi.mocked(uploadCampaignImage).mockImplementationOnce(() => new Promise<string>((resolve) => { resolveUpload = resolve }))
  await open()

  const toggle = screen.getByRole('button', { name: 'Add Recap & Photos' })
  const archive = screen.getByRole('button', { name: 'Archive' })
  fireEvent.click(toggle)
  const dialog = screen.getByRole('dialog', { name: 'Recap & photos for Alumni night' })
  const form = within(dialog).getByRole('form', { name: 'Recap for Alumni night' })
  const recap = within(form)
  fireEvent.change(recap.getByLabelText('Upload recap photos'), {
    target: { files: [new File(['img'], 'pending.jpg', { type: 'image/jpeg' })] },
  })

  expect(toggle).toBeDisabled()
  expect(archive).toBeDisabled()
  fireEvent.keyDown(document, { key: 'Escape' })
  fireEvent.click(dialog.parentElement!)
  expect(dialog).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeDisabled()

  await act(async () => { resolveUpload('https://images.example.com/pending.jpg') })
  await waitFor(() => expect(toggle).not.toBeDisabled())
  expect(archive).not.toBeDisabled()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(dialog).not.toBeInTheDocument()
})

it('defaults to Fundraiser Events, hides Prepare Next Year on active campaigns, and tucks HåfaPass slugs under Advanced', async () => {
  render(<MemoryRouter initialEntries={['/admin/campaign/host-year']}><AdminCampaignHostYearPage /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: /Campaign events/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Prepare Class of/ })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: /Settings & Links/i }))
  const advancedSummary = await screen.findByText(/Advanced · Countdown & HåfaPass ticketing setup/i)
  expect(advancedSummary.closest('details')).not.toHaveAttribute('open')
  fireEvent.click(advancedSummary)
  expect(advancedSummary.closest('details')).toHaveAttribute('open')
  expect(screen.getByLabelText(/HåfaPass host class organizer slug/i)).toBeInTheDocument()
})

it('uses the themed AdminConfirmDialog when archiving an event', async () => {
  const archiveSpy = vi.spyOn(api, 'campaignArchiveEvent').mockResolvedValue({ event: { ...adminEvent, archivedAt: '2026-11-24T00:00:00Z' } })
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  const dialog = await screen.findByRole('alertdialog', { name: /Archive "Alumni night"\?/i })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Archive event' }))
  await waitFor(() => expect(archiveSpy).toHaveBeenCalledWith(adminCampaign.slug, adminEvent.id))
})
