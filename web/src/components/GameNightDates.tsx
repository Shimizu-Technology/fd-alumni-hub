import { formatGuamDate } from '../lib/datetime'

export function GameNightDates({ dates, selected, today, onSelect }: {
  dates: string[]
  selected: string
  today?: string
  onSelect: (date: string) => void
}) {
  const showToday = Boolean(today && selected !== today)
  if (!dates.length && !showToday) return null

  return (
    <div className="game-night-dates" role="group" aria-label="Game nights (Guam time)">
      {showToday && <button className="game-night-date" type="button" aria-pressed={false} onClick={() => onSelect('')}>Today</button>}
      {dates.filter((date) => !showToday || date !== today).map((date) => (
        <button key={date} className="game-night-date" type="button" aria-pressed={date === selected} onClick={() => onSelect(date)}>
          {formatGuamDate(date, { weekday: 'short', year: undefined })}
        </button>
      ))}
    </div>
  )
}
