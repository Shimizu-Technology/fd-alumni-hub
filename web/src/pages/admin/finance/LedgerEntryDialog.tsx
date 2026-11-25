import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Field, FormGrid } from '../../../components/ui'
import { api } from '../../../lib/api'
import { mutationErrorMessage } from '../../../lib/errors'
import type { LedgerEntryType } from '../../../lib/types'
import { RECEIPT_UPLOAD_ACCEPT, uploadCampaignReceipt } from '../../../lib/uploads'
import { parseDollarsToCents, todayIsoDate, useAccessibleModal } from './financeFields'

const INCOME_SOURCES = [
  { value: 'fundraiser_gross', label: 'Fundraiser gross sales' },
  { value: 'fundraiser_net', label: 'Fundraiser net payout' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'donation', label: 'Donation' },
  { value: 'fdaa_allocation', label: 'FDAA Upfront Allocation' },
  { value: 'ticket_share', label: 'FDAA Ticket Share' },
  { value: 'merch', label: 'Merch Sales' },
  { value: 'golf_net', label: 'Golf net proceeds' },
  { value: 'other_income', label: 'Other Income' },
]

const EXPENSE_SOURCES = [
  { value: 'event_expense', label: 'Event Expense' },
  { value: 'merch_cost', label: 'Merch Cost' },
  { value: 'venue_ops', label: 'Venue / Ops' },
  { value: 'refund', label: 'Refund' },
  { value: 'other_expense', label: 'Other Expense' },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer / ACH' },
  { value: 'fdaa', label: 'FDAA' },
  { value: 'hafapass_payout', label: 'HåfaPass Payout' },
  { value: 'golf_payout', label: 'Golf Payout' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

function entryActionLabel(entryType: LedgerEntryType) {
  return entryType === 'income' ? 'Record money received' : 'Record expense'
}

type EntryOptions = Awaited<ReturnType<typeof api.campaignLedgerEntries>>['options']

export function LedgerEntryDialog({ campaignSlug, entryType, eventId, options, onClose, onRecorded }: {
  campaignSlug: string
  entryType: LedgerEntryType
  eventId: string | null
  options: EntryOptions
  onClose: () => void
  onRecorded: () => void
}) {
  const headingId = useId()
  const amountErrorId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [outOfPocket, setOutOfPocket] = useState(false)
  const [payerId, setPayerId] = useState('')
  const [receipt, setReceipt] = useState<{ token: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedEventId, setSelectedEventId] = useState(options.events.find((event) => event.id === eventId)?.id ?? '')

  const income = entryType === 'income'
  const action = entryActionLabel(entryType)
  const categories = income ? INCOME_SOURCES : EXPENSE_SOURCES
  const budgetLines = options.budgetLines.filter((line) => line.kind === entryType)
  const linkedEvent = options.events.find((event) => event.id === selectedEventId)
  const parsedAmount = parseDollarsToCents(amount, { positive: true })
  const amountError = amountTouched && !parsedAmount.ok ? parsedAmount.error : ''
  const busy = saving || uploading
  const dismiss = () => { if (!busy) onClose() }

  useAccessibleModal(true, dismiss, panelRef, amountRef)

  async function selectReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const token = await uploadCampaignReceipt({ file, campaignSlug })
      setReceipt({ token, name: file.name })
    } catch (cause) {
      setError(mutationErrorMessage(cause, 'Unable to upload receipt'))
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setAmountTouched(true)
    if (!parsedAmount.ok) {
      amountRef.current?.focus()
      return
    }

    const form = new FormData(event.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '').trim()
    if (!value('counterparty') || (outOfPocket && !payerId && !value('paidBy'))) {
      setError('Enter who paid or received the money, and name the out-of-pocket payer if applicable.')
      return
    }

    const category = categories.find((item) => item.value === value('source'))
    const budgetChoice = value('budgetLineId')
    const matchedBudgetLine = budgetLines.find((line) => line.category.toLowerCase() === category?.label.toLowerCase())
    setSaving(true)
    setError('')
    try {
      await api.campaignCreateLedgerEntry(campaignSlug, {
        entryType,
        amountCents: parsedAmount.value,
        entryDate: value('entryDate'),
        counterparty: value('counterparty'),
        source: value('source'),
        paymentMethod: value('paymentMethod'),
        budgetLineId: budgetChoice === 'match' ? matchedBudgetLine?.id ?? null : budgetChoice || null,
        campaignEventId: selectedEventId || null,
        sponsorId: value('sponsorId') || null,
        pledgeId: value('pledgeId') || null,
        referenceNumber: value('referenceNumber') || null,
        description: value('description') || null,
        paidBy: outOfPocket ? value('paidBy') || null : null,
        paidByUserId: outOfPocket ? payerId || null : null,
        reimbursementStatus: outOfPocket ? 'requested' : 'not_applicable',
        receiptUploadToken: receipt?.token,
      })
      onRecorded()
    } catch (cause) {
      const message = mutationErrorMessage(cause, 'Unable to record ledger entry')
      if (receipt && /token|expired/i.test(message)) {
        setReceipt(null)
        setError(`${message} Please reattach the receipt.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="finance-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) dismiss() }}>
      <div className="panel finance-modal-card ledger-entry-dialog" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
        <h2 id={headingId}>{action}</h2>
        <form className="page-stack" onSubmit={submit}>
          <FormGrid>
            <Field label="Amount ($)">
              <input ref={amountRef} inputMode="decimal" value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setAmountTouched(true)
                }} placeholder="250.00"
                aria-label="Amount ($)" aria-invalid={Boolean(amountError)} aria-describedby={amountError ? amountErrorId : undefined} />
              {amountError && <span id={amountErrorId} className="form-error">{amountError}</span>}
            </Field>
            <Field label="Date"><input name="entryDate" type="date" defaultValue={todayIsoDate()} required /></Field>
            <Field label={income ? 'Who paid' : 'Who received money'}>
              <input name="counterparty" required maxLength={180} placeholder={income ? 'e.g. Antigu Brewery cash/PayPal, Triple J, or John Cruz' : 'e.g. Antigu Brewery bar tab, Costco, or Print Shop'} />
            </Field>
            <Field label="Category">
              <select name="source" defaultValue={income ? 'fundraiser_net' : 'event_expense'}>
                {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </select>
            </Field>
            <Field label="Payment method">
              <select name="paymentMethod" defaultValue="cash">
                {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </Field>
            <Field label="Fundraiser event">
              <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                <option value="">None / General</option>
                {options.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
              </select>
            </Field>
          </FormGrid>
          <Field label="Notes (optional)">
            <textarea name="description" rows={2} placeholder={income ? 'e.g. Extra ticket cash turned in by Sean, or sponsor check note' : 'e.g. Flyers, ice, or venue deposit'} />
          </Field>
          {income && <p className="state-card">Gross sales are before fees. Fundraiser net payout is what actually arrived after fees (use this if you already have net cash or checks after venue costs). Record one or the other for the same proceeds.</p>}
          {linkedEvent && <p>Fundraiser event <strong>{linkedEvent.title}</strong></p>}
          {eventId && !options.events.some((event) => event.id === eventId) && <p role="status">This event is unavailable in the selected campaign.</p>}

          {!income && (
            <>
              <label className="check-field">
                <input type="checkbox" checked={outOfPocket} onChange={(event) => setOutOfPocket(event.target.checked)} />
                Someone paid out of pocket
              </label>
              {outOfPocket && (
                <FormGrid>
                  <Field label="Who paid out of pocket">
                    <select value={payerId} onChange={(event) => setPayerId(event.target.value)}>
                      <option value="">Enter a name</option>
                      {options.members.map((person) => <option key={person.id} value={person.id}>{person.fullName || person.email}</option>)}
                    </select>
                  </Field>
                  {!payerId && <Field label="Payer name"><input name="paidBy" required /></Field>}
                  <p className="muted">Saving requests reimbursement. Another chair or treasurer approves it.</p>
                </FormGrid>
              )}
            </>
          )}

          <details className="entry-details">
            <summary>More details</summary>
            <FormGrid>
              <Field label="Budget line">
                <select name="budgetLineId" defaultValue="match">
                  <option value="match">Match category if available</option>
                  <option value="">None</option>
                  {budgetLines.map((line) => <option key={line.id} value={line.id}>{line.category}</option>)}
                </select>
              </Field>
              <Field label="Sponsor">
                <select name="sponsorId">
                  <option value="">None</option>
                  {options.sponsors.map((sponsor) => <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>)}
                </select>
              </Field>
              {income && <Field label="Pledge link">
                <select name="pledgeId">
                  <option value="">None</option>
                  {options.pledges.map((pledge) => <option key={pledge.id} value={pledge.id}>{pledge.donorName} ({pledge.status})</option>)}
                </select>
              </Field>}
              <Field label="Reference number"><input name="referenceNumber" placeholder="Check #, PayPal ID, or deposit note" /></Field>
            </FormGrid>
          </details>

          <div>
            <div className="row-actions">
              <label className="btn secondary small file-upload-btn">
                <span>{uploading ? 'Uploading receipt…' : receipt ? `Receipt ready: ${receipt.name}` : 'Upload or take photo of receipt'}</span>
                <input className="sr-only" type="file" accept={RECEIPT_UPLOAD_ACCEPT} onChange={selectReceipt} disabled={busy} />
              </label>
              {receipt && <button className="btn secondary small" type="button" disabled={busy} onClick={() => setReceipt(null)}>Remove receipt</button>}
            </div>
            <p className="muted">Receipts stay private to authorized officers. You can also attach a receipt later from any saved entry.</p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="row-actions">
            <button className="btn secondary" type="button" onClick={dismiss} disabled={busy}>Cancel</button>
            <button className="btn primary" type="submit" disabled={busy}>{saving ? 'Recording…' : action}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
