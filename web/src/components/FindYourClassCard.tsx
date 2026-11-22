import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { classRouteKey } from '../lib/history'
import { staticChampionRecords } from '../lib/staticChampions'
import type { TournamentChampion } from '../lib/types'

const firstYear = 1974
const lastYear = 2026
const decades = [1970, 1980, 1990, 2000, 2010, 2020]
const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index)

const archive = staticChampionRecords()

function slotKey(record: TournamentChampion) {
  const bracket = record.bracket === 'unknown' ? 'overall' : record.bracket
  return `${record.year}/${bracket}`
}

function formatTitle(record: TournamentChampion) {
  const division = { gold: ' Gold', maroon: ' Maroon', platinum: ' Platinum', overall: '', unknown: '' }[record.bracket]
  const edition = record.editionLabel ? ` ${record.editionLabel}` : ''
  const score = record.score ? ` · ${record.score.replace(/\s*[-–—]\s*/g, '–')}` : ''
  return `${record.year}${edition}${division} Champs${score}`
}

function saveLegacyImage(year: number, summary: string, titleYears: number[]) {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1000
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const maroon = '#42101f'
  const gold = '#c89b3c'
  const cream = '#fffdf9'
  ctx.fillStyle = maroon
  ctx.fillRect(0, 0, 800, 1000)

  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  ctx.strokeRect(32, 32, 736, 936)
  ctx.lineWidth = 1
  ctx.strokeRect(42, 42, 716, 916)

  ctx.save()
  ctx.globalAlpha = .42
  ctx.lineWidth = 3
  ctx.strokeRect(140, 102, 520, 450)
  ctx.strokeRect(320, 102, 160, 184)
  ctx.beginPath()
  ctx.arc(400, 286, 80, 0, Math.PI)
  ctx.moveTo(173, 102)
  ctx.lineTo(173, 208)
  ctx.bezierCurveTo(173, 510, 627, 510, 627, 208)
  ctx.lineTo(627, 102)
  ctx.moveTo(368, 140)
  ctx.lineTo(432, 140)
  ctx.moveTo(416, 158)
  ctx.arc(400, 158, 16, 0, Math.PI * 2)
  ctx.moveTo(328, 552)
  ctx.arc(400, 552, 72, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = gold
  ctx.font = 'bold 22px system-ui'
  ctx.fillText('CLASS LEGACY', 400, 625)
  ctx.fillStyle = cream
  ctx.font = 'bold 80px Georgia, serif'
  ctx.fillText(`Class of ${year}`, 400, 720, 672)
  ctx.fillStyle = gold
  ctx.font = 'bold 32px system-ui'
  ctx.fillText(summary, 400, 780, 672)
  if (titleYears.length) {
    ctx.fillStyle = cream
    ctx.font = '22px system-ui'
    ctx.fillText(titleYears.join('  ·  '), 400, 827, 672)
  }
  ctx.fillStyle = cream
  ctx.font = 'bold 19px system-ui'
  ctx.fillText('FD ALUMNI BASKETBALL · THE JUNGLE', 400, 918, 672)

  const url = canvas.toDataURL('image/png')
  if (!url.startsWith('data:image/png')) return false

  const download = document.createElement('a')
  download.href = url
  download.download = `fd-class-of-${year}-legacy.png`
  document.body.append(download)
  try {
    download.click()
  } finally {
    download.remove()
  }
  return true
}

export function FindYourClassCard({ championRecords, hostClassYear }: {
  championRecords?: TournamentChampion[]
  hostClassYear?: number | null
}) {
  const headingId = useId()
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const year = selectedYear ?? (hostClassYear && years.includes(hostClassYear) ? hostClassYear : 2017)
  const decade = Math.floor(year / 10) * 10
  const key = String(year).slice(-2)
  const records = useMemo(() => {
    // Home only supplies recap records for the featured tournament; live records replace matching year/bracket slots.
    const live = championRecords ?? []
    const liveSlots = new Set(live.map(slotKey))
    const merged = [...archive.filter((record) => !liveSlots.has(slotKey(record))), ...live]
    return merged.sort((a, b) => b.year - a.year || a.position - b.position)
  }, [championRecords])

  const wins = records.filter((record) => record.status === 'completed' && record.championComponents.includes(key))
  const primaryCount = wins.filter((record) => record.primary).length
  const titleYears = [...new Set(wins.map((record) => record.year))]
  const titlesLabel = primaryCount ? `${primaryCount}× Champions`
    : wins.length ? `${wins.length}× Bracket ${wins.length === 1 ? 'Title' : 'Titles'}` : 'FD Alumni Class'
  const classPath = `/classes/${classRouteKey(key)}`
  const shareMessage = `FD Class of ${year} at The Jungle · ${titlesLabel}. Explore our class legacy: ${new URL(classPath, window.location.origin)}`

  function selectYear(next: number) {
    setSelectedYear(next)
    setStatus('')
  }

  function saveCard() {
    try {
      if (saveLegacyImage(year, titlesLabel, titleYears)) {
        setStatus('Card image ready — check your downloads.')
        return
      }
    } catch {
      // A browser or embedded webview can block canvas or downloads.
    }
    setStatus('Card image unavailable on this device.')
  }

  return (
    <section className="panel find-class" aria-labelledby={headingId}>
      <div className="find-class-controls">
        <h2 id={headingId}>Find Your Class</h2>
        <div className="heritage-options" role="group" aria-label="Class decade">
          {decades.map((start) => (
            <button key={start} type="button" aria-pressed={start === decade}
              onClick={() => selectYear(Math.max(firstYear, Math.min(lastYear, start + year % 10)))}>
              {String(start).slice(-2)}s
            </button>
          ))}
        </div>
        <label>
          Graduating year
          <select value={year} onChange={(event) => selectYear(Number(event.target.value))}>
            {years.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="class-legacy-card">
        <p className="eyebrow">Class Legacy Card</p>
        <h3 aria-live="polite">Class of {year}</h3>
        <div className="class-legacy-badges">
          <strong>{titlesLabel}</strong>
          {year === hostClassYear && <strong>Host Class</strong>}
        </div>
        {wins.length > 0 && (
          <ul className="class-legacy-titles" aria-label="Championship years">
            {wins.map((record) => <li key={record.id}>{formatTitle(record)}</li>)}
          </ul>
        )}
        <div className="class-legacy-actions">
          <Link className="btn secondary" to={classPath}>View class profile</Link>
          <a className="btn primary" href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">Share to WhatsApp</a>
          <button className="btn secondary" type="button" onClick={saveCard}>Save Card Image</button>
        </div>
        <p className="class-legacy-status" role="status">{status}</p>
      </div>
    </section>
  )
}
