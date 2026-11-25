import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import { RECEIPT_UPLOAD_ACCEPT, uploadCampaignReceipt } from '../../../lib/uploads'
import type { AdminHostCampaign, LedgerEntryRecord } from '../../../lib/types'
import { EmptyState, ErrorState, Field, LoadingState, Panel, StatusBadge } from '../../../components/ui'
import { formatUsd, useAccessibleModal } from './financeFields'

export function LedgerTab({
  campaign,
  entries,
  loading,
  ledgerError,
  onRetryLedger,
  canWrite,
  entryTypeFilter,
  includeVoided,
  onEntryTypeFilter,
  onIncludeVoided,
  onOpenReceipt,
  receiptLoadingId,
  onSaved,
}: {
  campaign: AdminHostCampaign
  entries: LedgerEntryRecord[]
  loading: boolean
  ledgerError: string | null
  onRetryLedger: () => Promise<void>
  canWrite: boolean
  entryTypeFilter: string
  includeVoided: boolean
  onEntryTypeFilter: (value: string) => void
  onIncludeVoided: (value: boolean) => void
  onOpenReceipt?: (entryId: string) => Promise<void>
  receiptLoadingId: string | null
  onSaved: () => Promise<void>
}) {
  const [attachingEntryId, setAttachingEntryId] = useState<string | null>(null)
  const [voidingEntry, setVoidingEntry] = useState<LedgerEntryRecord | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleAttachReceiptToExisting = async (entryId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAttachingEntryId(entryId)
    setError('')
    setMessage('')
    try {
      const token = await uploadCampaignReceipt({ file, campaignSlug: campaign.slug })
      await api.campaignUpdateLedgerEntry(campaign.slug, entryId, { receiptUploadToken: token })
      setMessage('Receipt attached.')
      await onSaved()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to attach receipt'))
    } finally {
      setAttachingEntryId(null)
    }
  }

  return (
    <div className="page-stack">
      {voidingEntry && (
        <VoidEntryModal
          campaignSlug={campaign.slug}
          entry={voidingEntry}
          onClose={() => setVoidingEntry(null)}
          onVoided={async () => {
            const targetId = voidingEntry.id
            setVoidingEntry((prev) => (prev?.id === targetId ? null : prev))
            setError('')
            setMessage('Ledger entry voided and logged in audit trail.')
            await onSaved()
          }}
        />
      )}

      <Panel>
        <div className="section-heading">
          <h2>Ledger entries ({entries.length})</h2>
          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            <select aria-label="Filter by entry type" value={entryTypeFilter} onChange={(e) => onEntryTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="income">Income only</option>
              <option value="expense">Expense only</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={includeVoided} onChange={(e) => onIncludeVoided(e.target.checked)} />
              <span>Show voided</span>
            </label>
          </div>
        </div>

        {message && <p role="status" style={{ margin: '0.6rem 0' }}>{message}</p>}
        {error && <p className="form-error" role="alert" style={{ margin: '0.6rem 0' }}>{error}</p>}
        {canWrite && entries.length > 0 && (
          <p className="muted" style={{ margin: '0.25rem 0 0.65rem', fontSize: '0.88rem' }}>
            Made a typo? Click Void with a short note and re-enter the entry so the board audit trail stays intact.
          </p>
        )}

        {ledgerError ? (
          <ErrorState message={ledgerError} onRetry={onRetryLedger} />
        ) : loading ? (
          <LoadingState label="Loading ledger entries" />
        ) : entries.length === 0 ? (
          <EmptyState title="No ledger entries yet" description="Record your first fundraiser payout, sponsorship, or expense above." />
        ) : (
          <div className="admin-list">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="compact-admin-row"
                style={{
                  padding: '0.85rem 0',
                  borderBottom: '1px solid var(--line)',
                  opacity: entry.voided ? 0.65 : 1,
                }}
              >
                <div>
                  <strong>
                    {entry.entryType === 'income' ? '+' : '−'}{formatUsd(entry.amountCents)} · {entry.counterparty}
                  </strong>{' '}
                  <span className="pill">{entry.source.replace(/_/g, ' ')}</span>{' '}
                  {entry.voided && <span className="status-badge status-cancelled">voided</span>}
                  {entry.reimbursementStatus !== 'not_applicable' && (
                    <> <StatusBadge status={entry.reimbursementStatus} /></>
                  )}
                  <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                    {entry.entryDate} · {entry.paymentMethod.replace(/_/g, ' ')}
                    {entry.budgetLineCategory ? ` · ${entry.budgetLineCategory}` : ''}
                    {entry.campaignEventTitle ? ` · ${entry.campaignEventTitle}` : ''}
                    {entry.pledgeDonorName ? ` · Pledge: ${entry.pledgeDonorName}` : ''}
                  </p>
                  {entry.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.92rem' }}>{entry.description}</p>}
                  {entry.voided && entry.voidReason && (
                    <p className="form-error" style={{ margin: '0.2rem 0 0', fontSize: '0.86rem' }}>
                      Voided: {entry.voidReason} ({entry.voidedByName || 'Officer'})
                    </p>
                  )}
                </div>

                <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                  {entry.hasReceipt ? (
                    onOpenReceipt && (
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={receiptLoadingId === entry.id}
                        onClick={() => void onOpenReceipt(entry.id)}
                      >
                        {receiptLoadingId === entry.id ? 'Opening…' : 'View receipt'}
                      </button>
                    )
                  ) : (
                    canWrite && !entry.voided && (
                      <label className="btn secondary small file-upload-btn">
                        <span>{attachingEntryId === entry.id ? 'Uploading…' : 'Add receipt'}</span>
                        <input
                          className="sr-only"
                          type="file"
                          accept={RECEIPT_UPLOAD_ACCEPT}
                          onChange={(e) => void handleAttachReceiptToExisting(entry.id, e)}
                          disabled={attachingEntryId === entry.id}
                        />
                      </label>
                    )
                  )}
                  {canWrite && !entry.voided && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => {
                        setError('')
                        setMessage('')
                        setVoidingEntry(entry)
                      }}
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function VoidEntryModal({
  campaignSlug,
  entry,
  onClose,
  onVoided,
}: {
  campaignSlug: string
  entry: LedgerEntryRecord
  onClose: () => void
  onVoided: () => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useAccessibleModal(true, onClose, panelRef, inputRef)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reason.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.campaignVoidLedgerEntry(campaignSlug, entry.id, reason.trim())
      await onVoided()
    } catch (err) {
      setError(mutationErrorMessage(err, 'Unable to void ledger entry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="finance-modal-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        className="panel finance-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Void ledger entry ${entry.id}`}
        tabIndex={-1}
      >
        <div className="section-heading">
          <h2>Void ledger entry #{entry.id}</h2>
          <button type="button" className="btn secondary small" onClick={onClose}>Cancel</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Voiding preserves audit history instead of deleting: <strong>{entry.counterparty}</strong> · {formatUsd(entry.amountCents)} ({entry.entryDate}).
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Reason for void (required)">
            <input ref={inputRef} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Duplicate entry / entered wrong amount" />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn secondary" onClick={onClose}>Keep entry</button>
            <button type="submit" className="btn primary" disabled={saving || !reason.trim()}>
              {saving ? 'Voiding…' : 'Confirm void'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
