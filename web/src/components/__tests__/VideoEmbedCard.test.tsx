import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { MediaAsset } from '../../lib/types'
import { VideoEmbedCard } from '../VideoEmbedCard'

const asset: MediaAsset = {
  id: '1', tournamentId: '10', gameId: null, title: 'Finals broadcast', source: 'Acdavate',
  imageUrl: null, articleUrl: null, caption: null, tags: null, tagList: [], takenAt: null,
  mediaType: 'video', videoProvider: 'youtube', externalVideoId: 'gExNQKCX60E',
  durationSeconds: 5293, divisionSlug: 'gold',
}

afterEach(cleanup)

it('loads the privacy-enhanced player only after play and keeps a YouTube link', () => {
  render(<VideoEmbedCard asset={asset} />)
  expect(screen.queryByTitle('Finals broadcast')).not.toBeInTheDocument()
  expect(screen.getByText('1:28:13')).toBeInTheDocument()
  expect(screen.getByText('Gold')).toBeInTheDocument()
  expect(screen.getByText('Acdavate')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Play Finals broadcast' }))
  expect(screen.getByTitle('Finals broadcast')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/gExNQKCX60E?autoplay=1')
  expect(screen.getByRole('link', { name: /watch on youtube/i })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=gExNQKCX60E')
})

it.each(['short', 'abcdefghijk\n', 'abc/defghij', 'javascript:alert(1)'])('rejects the unsafe ID %j and ignores untrusted embed URLs', (externalVideoId) => {
  render(<VideoEmbedCard asset={{ ...asset, externalVideoId, embedUrl: 'https://example.com/embed', videoUrl: 'javascript:alert(1)' }} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByTitle('Finals broadcast')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('formats durations under an hour', () => {
  render(<VideoEmbedCard asset={{ ...asset, durationSeconds: 127 }} />)
  expect(screen.getByText('02:07')).toBeInTheDocument()
})
