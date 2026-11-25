import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api'
import { GalleryPage } from './GalleryPage'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GalleryPage', () => {
  it('replaces broken external photo URLs with an FD placeholder on error', async () => {
    vi.spyOn(api, 'publicMedia').mockResolvedValue({
      tournament: null,
      mediaAssets: [
        {
          id: '10',
          tournamentId: '1',
          gameId: null,
          title: '2015 Championship Night',
          mediaType: 'photo',
          source: 'GSPN',
          imageUrl: 'https://example.com/missing-photo.jpg',
          videoUrl: null,
          articleUrl: 'https://example.com/story',
          caption: 'Archived photo',
          takenAt: '2015-07-10T00:00:00Z',
          tags: null,
          tagList: [],
          game: null,
        },
      ],
    })

    const { container } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>,
    )

    const img = await screen.findByRole('img', { name: 'Archived photo' })
    fireEvent.error(img)

    expect(screen.queryByRole('img', { name: 'Archived photo' })).toBeNull()
    expect(container.querySelector('.gallery-card .image-placeholder')).toHaveTextContent('FD')
  })
})
