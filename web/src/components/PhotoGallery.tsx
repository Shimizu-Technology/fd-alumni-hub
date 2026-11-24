import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

export function PhotoGallery({ photos, title, photoLabel, headingLevel = 3 }: {
  photos: { url: string; caption?: string }[]; title: string; photoLabel: string; headingLevel?: 2 | 3
}) {
  const [selectedIndex, setIndex] = useState(0)
  const index = Math.min(selectedIndex, photos.length - 1)
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLButtonElement>(null)

  const open = (event: MouseEvent<HTMLButtonElement>, photoIndex: number) => {
    opener.current = event.currentTarget
    setIndex(photoIndex)
    dialog.current?.showModal()
    closeButton.current?.focus()
  }

  const close = () => {
    dialog.current?.close()
    opener.current?.focus()
  }

  const move = (offset: number) => setIndex((current) => (Math.min(current, photos.length - 1) + offset + photos.length) % photos.length)
  const handleKeys = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
  }

  const photo = photos[index]
  if (!photo) return null
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section>
      <Heading>{title}</Heading>
      <div className="fundraiser-photo-grid">
        {photos.map((item, photoIndex) => (
          <figure key={`${item.url}-${photoIndex}`}>
            <button type="button" className="fundraiser-photo-button" onClick={(event) => open(event, photoIndex)}
              aria-label={`Open ${photoLabel} ${photoIndex + 1}${item.caption ? `, ${item.caption}` : ''}`}>
              <img src={item.url} alt="" loading="lazy" />
            </button>
            {item.caption && <figcaption>{item.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <dialog ref={dialog} className="recap-lightbox" aria-modal="true" aria-label={title}
        onClick={(event) => { if (event.target === event.currentTarget) close() }}
        onKeyDown={handleKeys} onCancel={(event) => { event.preventDefault(); close() }}>
        <div className="recap-lightbox-toolbar">
          <span aria-live="polite">{index + 1} of {photos.length}</span>
          <button type="button" className="btn secondary small" ref={closeButton} onClick={close}>Close</button>
        </div>
        <figure>
          <img src={photo.url} alt={photo.caption ? '' : `${photoLabel} ${index + 1}`} />
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
        {photos.length > 1 && (
          <div className="recap-lightbox-toolbar">
            <button type="button" className="btn secondary small" onClick={() => move(-1)}>Previous</button>
            <button type="button" className="btn secondary small" onClick={() => move(1)}>Next</button>
          </div>
        )}
      </dialog>
    </section>
  )
}
