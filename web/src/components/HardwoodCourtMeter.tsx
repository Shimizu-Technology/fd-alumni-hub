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
  const percent = Math.min(100, Math.max(0, meter.percent))
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
          <strong className="host-meter-percent">{Math.round(percent)}%</strong>
          {meter.goalReached && <span className="status-badge completed">Goal reached</span>}
        </div>
      </div>

      <svg className="host-meter-court" viewBox="0 0 560 260" aria-hidden="true">
        <rect className="host-meter-court-fill" width="560" height="260" fill="#c89b3c"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }} />
        <g stroke="#6f1d35" strokeWidth="3" fill="none">
          <rect x="13" y="13" width="534" height="234" rx="4" />
          <path d="M13 34H72a96 96 0 0 1 0 192H13 M13 90H125v80H13 M125 90a40 40 0 0 1 0 80 M39 111v38 M547 79a51 51 0 0 0 0 102" />
          <circle cx="53" cy="130" r="8" />
        </g>
        <path d="M125 90a40 40 0 0 0 0 80" stroke="#6f1d35" strokeWidth="2" strokeDasharray="5 5" fill="none" />
      </svg>

      <div className="host-meter-track" role="progressbar" aria-label="Fundraising goal progress"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}
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
