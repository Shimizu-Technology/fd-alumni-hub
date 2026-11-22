import { useId } from 'react'

export function PlayerStatsToggle({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}) {
  const helpId = useId()
  return (
    <div className="player-stats-setting">
      <label className="player-stats-toggle">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}
          disabled={disabled} aria-describedby={helpId} />
        <strong>Enable optional per-player box scores &amp; stat leaders</strong>
      </label>
      <p className="form-note" id={helpId}>Save the final score as usual. Player stats appear afterward as a collapsed, optional step.</p>
    </div>
  )
}
