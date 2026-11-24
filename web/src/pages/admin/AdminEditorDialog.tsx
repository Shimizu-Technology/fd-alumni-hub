import { useId, useRef, type ReactNode } from 'react'
import { useAccessibleModal } from './finance/financeFields'

export function AdminEditorDialog({ title, children, onClose, busy, drawer = false }: {
  title: string
  children: ReactNode
  onClose: () => void
  busy: boolean
  drawer?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const dismiss = () => {
    if (!busy) onClose()
  }
  useAccessibleModal(true, dismiss, panelRef, closeRef)

  return (
    <div className={`finance-modal-backdrop admin-editor-backdrop${drawer ? ' admin-editor-drawer' : ''}`} onClick={(event) => {
      if (event.target === event.currentTarget) dismiss()
    }}>
      <div ref={panelRef} className="panel finance-modal-card admin-editor-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}>
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
          <button ref={closeRef} className="btn secondary small" type="button" disabled={busy} onClick={dismiss}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
