import { useMotionOk } from '../hooks/useMotionOk'
import { formatGuamDateTime } from '../lib/datetime'
import type { HostCampaignMeter } from '../lib/types'
import { Panel } from './ui'

const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export function HardwoodCourtMeter({ meter }: { meter: Extract<HostCampaignMeter, { enabled: true }> }) {
  const motionOk = useMotionOk()
  const rawPercent = Number.isFinite(meter.percent) ? meter.percent : 0
  const percent = Math.min(100, Math.max(0, rawPercent))
  const displayPercent = meter.goalReached ? Math.round(percent) : Math.min(99, Math.round(percent))
  const raised = dollars.format(meter.raisedCents / 100)
  const goal = dollars.format(meter.goalCents / 100)
  const remaining = dollars.format(Math.max(meter.goalCents - meter.raisedCents, 0) / 100)

  return (
    <Panel className={`host-meter-panel${motionOk ? ' host-meter--motion' : ''}`}>
      <div className="host-meter-head">
        <div>
          <p className="eyebrow">Host-year fundraising goal</p>
          <h2>Raised {raised} of {goal}</h2>
        </div>
        <div className="host-meter-meta">
          <strong className="host-meter-percent">{displayPercent}%</strong>
          {meter.goalReached && <span className="status-badge completed">Goal reached</span>}
        </div>
      </div>

      <svg className="host-meter-court" viewBox="0 0 560 260" aria-hidden="true">
        <defs>
          <linearGradient id="arenaHardwood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3c261d" />
            <stop offset="100%" stopColor="#261712" />
          </linearGradient>
          <linearGradient id="arenaCourtFill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#981d3f" />
            <stop offset="100%" stopColor="#e6b84c" />
          </linearGradient>
        </defs>
        <rect width="560" height="260" fill="url(#arenaHardwood)" />
        <rect className="host-meter-court-fill" width="560" height="260" fill="url(#arenaCourtFill)" fillOpacity="0.78"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }} />
        <g stroke="#f7e6c4" strokeOpacity="0.52" strokeWidth="2.5" fill="none">
          <rect x="13" y="13" width="534" height="234" rx="6" />
          <line x1="280" y1="13" x2="280" y2="247" strokeOpacity="0.38" />
          <circle cx="280" cy="130" r="42" strokeOpacity="0.42" />
          <path d="M13 34H72a96 96 0 0 1 0 192H13 M13 90H125v80H13 M125 90a40 40 0 0 1 0 80 M39 111v38" />
          <path d="M547 34h-59a96 96 0 0 0 0 192h59 M547 90H435v80h112 M435 90a40 40 0 0 0 0 80 M521 111v38" strokeOpacity="0.35" />
          <circle cx="53" cy="130" r="8" stroke="#e6b84c" strokeOpacity="0.9" />
          <circle cx="507" cy="130" r="8" strokeOpacity="0.4" />
        </g>
        <path d="M125 90a40 40 0 0 0 0 80" stroke="#f7e6c4" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 5" fill="none" />
      </svg>

      <div className="host-meter-track" role="progressbar" aria-label="Fundraising goal progress"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={displayPercent}
        aria-valuetext={`Raised ${raised} of ${goal}`}>
        <div className="host-meter-fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>

      <div className="host-meter-foot">
        <span>{meter.goalReached
          ? 'Goal reached. Thank you to every alumnus, sponsor, and supporter.'
          : `${remaining} remaining toward the host-year goal.`}</span>
        {meter.updatedAt && <small>Updated {formatGuamDateTime(meter.updatedAt)}</small>}
      </div>
    </Panel>
  )
}
