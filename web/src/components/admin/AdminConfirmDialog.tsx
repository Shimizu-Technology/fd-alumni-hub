import { useId, useRef } from 'react'
import { useAccessibleModal } from '../../pages/admin/finance/financeFields'

export type ConfirmDialogRequest = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

export function AdminConfirmDialog({
  request,
  busy = false,
  onClose,
}: {
  request: ConfirmDialogRequest | null
  busy?: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dismiss = () => {
    if (!busy) onClose()
  }
  useAccessibleModal(Boolean(request), dismiss, panelRef, cancelRef)

  if (!request) return null

  const confirm = async () => {
    if (busy) return
    const action = request.onConfirm
    onClose()
    await action()
  }

  return (
    <div
      className="finance-modal-backdrop admin-editor-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss()
      }}
    >
      <div
        ref={panelRef}
        className="panel finance-modal-card admin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="section-heading">
          <h2 id={titleId}>{request.title}</h2>
        </div>
        <p id={descId} className="admin-confirm-message">{request.message}</p>
        <div className="row-actions admin-confirm-actions">
          <button ref={cancelRef} type="button" className="btn secondary" disabled={busy} onClick={dismiss}>
            {request.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            className={`btn ${request.destructive ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {request.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
