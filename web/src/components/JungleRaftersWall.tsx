import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { classRouteKey } from '../lib/history'
import type { TournamentChampion } from '../lib/types'
import { DivisionPill } from './ArchiveBadges'

const eras = [
  { label: '2015–2026', from: 2015, to: 2026 },
  { label: '2005–2014', from: 2005, to: 2014 },
  { label: '1995–2004', from: 1995, to: 2004 },
  { label: '1985–1994', from: 1985, to: 1994 },
  { label: 'All', from: -Infinity, to: Infinity },
]

function ChampionshipBanner({ record }: { record: TournamentChampion }) {
  const [flipped, setFlipped] = useState(false)
  const front = useRef<HTMLButtonElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const returnFocus = useRef(false)
  const detailsId = useId()
  const cancelled = record.status === 'cancelled'
  const hasChampion = record.status === 'completed' && Boolean(record.championLabel)
  const primaryClassKey = classRouteKey(record.championComponents[0] || record.championKey)
  const edition = [record.year, record.editionLabel].filter(Boolean).join(' ')
  const division = record.bracket === 'unknown' ? 'overall' : record.bracket
  const headline = cancelled ? 'Tournament cancelled' : hasChampion ? record.championLabel : 'Championship pending'
  const highlight = record.mvpName ? [record.mvpName, record.mvpNote].filter(Boolean).join(' · ') : record.mvpNote || record.notes

  useLayoutEffect(() => {
    if (returnFocus.current) {
      (flipped ? back : front).current?.focus({ preventScroll: true })
      returnFocus.current = false
    }
  }, [flipped])

  function flip() {
    returnFocus.current = true
    setFlipped(!flipped)
  }

  return (
    <li className={`rafters-banner rafters-banner--${cancelled ? 'cancelled' : division}`}>
      <div className="rafters-banner-turn" data-flipped={flipped}>
        <button type="button" className="rafters-face rafters-front" ref={front} inert={flipped}
          aria-hidden={flipped} aria-controls={detailsId} aria-expanded={flipped} onClick={flip}>
          <span className="rafters-edition">{edition}</span>
          <strong>{headline}</strong>
          {division === 'overall' ? <span className="archive-pill">Overall</span> : <DivisionPill division={division} />}
          <small>Tap for details</small>
        </button>
        <div className="rafters-face rafters-back" id={detailsId} ref={back} tabIndex={-1}
          role="group" aria-labelledby={`${detailsId}-title`} inert={!flipped} aria-hidden={!flipped}>
          <strong id={`${detailsId}-title`}>{[edition, cancelled ? 'Cancelled' : headline].join(' · ')}</strong>
          {record.runnerUpLabel && <p>Runner-up · {record.runnerUpLabel}</p>}
          {record.score && <p>Final score · {record.score.replace(/\s*[-–—]\s*/g, '–')}</p>}
          {highlight && <p>{highlight}</p>}
          <div className="rafters-actions">
            <Link to={`/history/${record.year}`}>View {record.year} archive</Link>
            {primaryClassKey && hasChampion && <Link to={`/classes/${primaryClassKey}`}>Class profile</Link>}
            <button type="button" onClick={flip}>Flip back</button>
          </div>
        </div>
      </div>
    </li>
  )
}

export function JungleRaftersWall({ records }: { records: TournamentChampion[] }) {
  const headingId = useId()
  const [selected, setSelected] = useState(0)
  const { from, to } = eras[selected]
  const filtered = records.filter((record) => record.year >= from && record.year <= to)

  return (
    <section className="jungle-rafters" aria-labelledby={headingId}>
      <div className="rafters-heading">
        <h2 id={headingId}>The Jungle Rafters</h2>
        <div className="heritage-options" role="group" aria-label="Championship era">
          {eras.map((era, index) => (
            <button key={era.label} type="button" aria-pressed={index === selected} onClick={() => setSelected(index)}>{era.label}</button>
          ))}
        </div>
        {filtered.length > 1 && <p className="rafters-swipe">Swipe to explore the banners <span aria-hidden="true">→</span></p>}
      </div>
      {filtered.length
        ? <ul key={selected} className="rafters-rail">{filtered.map((record) => <ChampionshipBanner key={record.id} record={record} />)}</ul>
        : <p className="rafters-empty">No recorded editions in this era.</p>}
    </section>
  )
}
