import { useState } from 'react'
import type { PredictionPoll } from '../lib/types'

export function PredictionPollCard({ poll, onVote, compact = false }: { poll: PredictionPoll; onVote: (poll: PredictionPoll, teamId: string) => Promise<void>; compact?: boolean }) {
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null)

  const choose = async (teamId: string) => {
    setSavingTeamId(teamId)
    try {
      await onVote(poll, teamId)
    } finally {
      setSavingTeamId(null)
    }
  }

  return (
    <div className={`prediction-card ${compact ? 'compact' : ''}`}>
      <div className="prediction-card-head">
        <span>{poll.open ? 'Voting open' : 'Voting closed'}</span>
        <strong>{poll.question}</strong>
      </div>
      <div className="prediction-options">
        {poll.options.map((option) => (
          <button key={option.teamId} type="button" className={option.selected ? 'selected' : ''} onClick={() => choose(option.teamId)} disabled={!poll.open || savingTeamId !== null}>
            <span>{option.displayName}</span>
            <small>{option.percent ?? 0}% · {option.votes ?? 0} votes</small>
          </button>
        ))}
      </div>
      {poll.selectedTeamId && poll.open && <small className="prediction-note">Vote saved. Tap another team to change it.</small>}
    </div>
  )
}
