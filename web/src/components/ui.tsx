import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string | number; detail?: string; tone?: 'neutral' | 'maroon' | 'gold' | 'live' }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>
}

export function LoadingState({ label = 'Loading tournament data' }: { label?: string }) {
  return <div className="state-card"><span className="spinner" aria-hidden="true" /><p>{label}</p></div>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="state-card empty-state">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card error-state">
      <h2>Something needs attention</h2>
      <p>{message}</p>
      {onRetry && <button className="btn secondary" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function StatusBadge({ status }: { status?: string | null }) {
  const safe = status || 'unknown'
  return <span className={`status-badge status-${safe}`}>{safe.replace('_', ' ')}</span>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>
}
