import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
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
  const form = within(screen.getByRole('form', { name: 'Recap for Alumni night' }))
  fireEvent.change(form.getByLabelText('Amount raised'), { target: { value: '$4,200 raised' } })
  fireEvent.change(form.getByLabelText('Recap notes'), { target: { value: 'Thank you!' } })
  fireEvent.change(form.getByLabelText('Recap highlights'), { target: { value: 'Alumni scrimmage.' } })
  const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' })
  const second = new File(['second'], 'second.jpg', { type: 'image/jpeg' })
  const picker = form.getByLabelText('Upload recap photos')
  expect(picker).toHaveAttribute('multiple')
  fireEvent.change(picker, { target: { files: [first, second] } })
  expect(await form.findByRole('alert')).toHaveTextContent('Could not upload first.jpg')
  expect(form.getByRole('img', { name: 'Recap photo 1 preview' })).toHaveAttribute('src', 'https://images.example.com/second.jpg')
  fireEvent.change(picker, { target: { files: [first] } })
  expect(await form.findByRole('img', { name: 'Recap photo 2 preview' })).toHaveAttribute('src', 'https://images.example.com/first.jpg')
  fireEvent.click(form.getByRole('button', { name: 'Remove photo 1' }))
  fireEvent.change(form.getByLabelText('Caption for photo 1'), { target: { value: 'The team' } })
  fireEvent.click(form.getByRole('button', { name: 'Save recap' }))
  expect(await form.findByRole('status')).toHaveTextContent('Recap saved.')
  expect(update).toHaveBeenCalledWith(adminCampaign.slug, adminEvent.id, {
    recapNotes: 'Thank you!', recapHighlights: 'Alumni scrimmage.', raisedDisplay: '$4,200 raised',
    recapPhotos: [{ url: 'https://images.example.com/first.jpg', caption: 'The team' }],
  })
  fireEvent.click(form.getByRole('button', { name: 'Close recap editor' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Recap & Photos' }))
  expect(screen.getByLabelText('Caption for photo 1')).toHaveValue('The team')
})
