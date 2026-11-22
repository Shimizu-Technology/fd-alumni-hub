import { useState } from 'react'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import type { AdminHostCampaign, LedgerEntryRecord } from '../../../lib/types'
import { EmptyState, Panel } from '../../../components/ui'
import { formatUsd } from './financeFields'

export function ReimbursementProgress({ status, canApprove, isSelf }: {
  status: LedgerEntryRecord['reimbursementStatus']
  canApprove: boolean
  isSelf: boolean
}) {
  const steps = [
    ['requested', 'Awaiting another officer'],
    ['approved', 'Approved'],
    ['reimbursed', 'Paid'],
  ]
  return (
    <>
      <ol className="reimbursement-progress" aria-label="Reimbursement progress">
        {steps.map(([value, label], index) => (
          <li key={value} aria-current={status === value ? 'step' : undefined}>
            {index > 0 && <span aria-hidden="true"> → </span>}{label}
          </li>
        ))}
      </ol>
      {status === 'requested' && <p className="muted">
        {canApprove && !isSelf ? 'Ready to approve.' : 'Awaiting approval from another chair or treasurer.'}
        {isSelf && ' The person who recorded or paid the expense cannot approve it.'}
      </p>}
      {status === 'approved' && <p className="muted">Approved — ready for treasurer payout.</p>}
    </>
  )
}

export function ReimbursementsTab({
  campaign,
  entries,
  currentUserId,
  canApprove,
  canMarkReimbursed,
  receiptLoadingId,
  onOpenReceipt,
  onSaved,
}: {
  campaign: AdminHostCampaign
  entries: LedgerEntryRecord[]
  currentUserId: string
  canApprove: boolean
  canMarkReimbursed: boolean
  receiptLoadingId: string | null
  onOpenReceipt?: (entryId: string) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const [references, setReferences] = useState<Record<string, string>>({})
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const setEntryBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      if (busy) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const reimbEntries = entries.filter((e) => !e.voided && e.entryType === 'expense' && e.reimbursementStatus !== 'not_applicable')

  const handleApprove = async (entry: LedgerEntryRecord) => {
    setEntryBusy(entry.id, true)
    setError('')
    setMessage('')
    try {
      await api.campaignApproveReimbursement(campaign.slug, entry.id)
      setMessage(`Approved reimbursement for ${entry.counterparty}.`)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to approve reimbursement'))
    } finally {
      setEntryBusy(entry.id, false)
    }
  }

  const handleMarkReimbursed = async (entry: LedgerEntryRecord) => {
    setEntryBusy(entry.id, true)
    setError('')
    setMessage('')
    try {
      await api.campaignMarkReimbursed(campaign.slug, entry.id, {
        reimbursementReference: references[entry.id]?.trim() || undefined,
      })
      setMessage(`Marked ${entry.counterparty} as reimbursed.`)
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to mark reimbursed'))
    } finally {
      setEntryBusy(entry.id, false)
    }
  }

  return (
    <Panel>
      <h2>Reimbursement approval queue ({reimbEntries.length})</h2>
      <p className="muted">Separation of duties: neither the out-of-pocket payer nor the officer who recorded the expense can self-approve.</p>
      {message && <p role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}

      {reimbEntries.length === 0 ? (
        <EmptyState title="No reimbursement requests" description="Expenses marked for reimbursement appear here for second-officer approval and payout tracking." />
      ) : (
        <div className="admin-list">
          {reimbEntries.map((entry) => {
            const isSelfPayer = Boolean(entry.paidByUserId && entry.paidByUserId === currentUserId)
            const isRecorder = entry.recordedById === currentUserId
            return (
              <div key={entry.id} className="compact-admin-row" style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{formatUsd(entry.amountCents)} · {entry.counterparty}</strong>{' '}
                  <p className="muted" style={{ margin: '0.2rem 0 0' }}>
                    Paid by: {entry.paidByUserName || entry.paidBy || 'Unspecified'} · {entry.entryDate}
                    {entry.reimbursementApprovedByName ? ` · Approved by ${entry.reimbursementApprovedByName}` : ''}
                    {entry.reimbursedAt ? ` · Reimbursed ${entry.reimbursedAt}` : ''}
                    {entry.reimbursementReference ? ` (${entry.reimbursementReference})` : ''}
                  </p>
                  <ReimbursementProgress status={entry.reimbursementStatus} canApprove={canApprove} isSelf={isSelfPayer || isRecorder} />
                </div>

                <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                  {entry.hasReceipt && onOpenReceipt && (
                    <button
                      type="button"
                      className="btn secondary small"
                      disabled={receiptLoadingId === entry.id}
                      onClick={() => void onOpenReceipt?.(entry.id)}
                    >
                      {receiptLoadingId === entry.id ? 'Opening…' : 'View receipt'}
                    </button>
                  )}
                  {entry.reimbursementStatus === 'requested' && canApprove && !isSelfPayer && !isRecorder && (
                    <button type="button" className="btn primary small" disabled={Boolean(busyIds[entry.id])} onClick={() => void handleApprove(entry)}>
                      {busyIds[entry.id] ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                  {entry.reimbursementStatus === 'approved' && canMarkReimbursed && (
                    <>
                      <input
                        aria-label={`Reimbursement reference for ${entry.counterparty}`}
                        placeholder="Check / transfer ref"
                        value={references[entry.id] || ''}
                        onChange={(e) => setReferences((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                        style={{ maxWidth: '11rem' }}
                      />
                      <button type="button" className="btn primary small" disabled={Boolean(busyIds[entry.id])} onClick={() => void handleMarkReimbursed(entry)}>
                        {busyIds[entry.id] ? 'Saving…' : 'Mark reimbursed'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
