'use client'

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { Loader2, Upload, CheckCircle2, XCircle, Info } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   Shared Input Styles
   ───────────────────────────────────────────────────────────── */

export const inputBaseClasses = `
  w-full rounded-lg border px-3 py-2.5 text-sm
  bg-white text-[var(--fd-ink)]
  border-[var(--border-subtle)]
  placeholder:text-[var(--neutral-400)]
  transition-all duration-150 ease-out
  focus:outline-none focus:ring-2 focus:ring-[var(--fd-maroon)]/20 focus:border-[var(--fd-maroon)]
  disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--neutral-50)]
`

export const labelClasses = `
  mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--neutral-500)]
`

/* ─────────────────────────────────────────────────────────────
   AdminInput
   ───────────────────────────────────────────────────────────── */

interface AdminInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const AdminInput = forwardRef<HTMLInputElement, AdminInputProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className={labelClasses}>{label}</label>}
        <input
          ref={ref}
          className={`${inputBaseClasses} ${error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <XCircle className="h-3 w-3" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1 flex items-center gap-1 text-xs text-[var(--neutral-400)]">
            <Info className="h-3 w-3" />
            {hint}
          </p>
        )}
      </div>
    )
  }
)
AdminInput.displayName = 'AdminInput'

/* ─────────────────────────────────────────────────────────────
   AdminSelect
   ───────────────────────────────────────────────────────────── */

interface AdminSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  ({ label, error, className = '', children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className={labelClasses}>{label}</label>}
        <select
          ref={ref}
          className={`${inputBaseClasses} cursor-pointer ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <XCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>
    )
  }
)
AdminSelect.displayName = 'AdminSelect'

/* ─────────────────────────────────────────────────────────────
   AdminFileInput - Clear upload affordance
   ───────────────────────────────────────────────────────────── */

interface AdminFileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  hint?: string
  selectedFileName?: string | null
}

export const AdminFileInput = forwardRef<HTMLInputElement, AdminFileInputProps>(
  ({ label, hint, selectedFileName, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className={labelClasses}>{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            type="file"
            className="peer absolute inset-0 z-10 cursor-pointer opacity-0"
            {...props}
          />
          <div
            className={`
              flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3
              border-[var(--border-subtle)] bg-[var(--bg-card-subtle)]
              transition-all duration-150 ease-out
              peer-hover:border-[var(--fd-maroon)]/50 peer-hover:bg-[var(--fd-maroon)]/5
              peer-focus:border-[var(--fd-maroon)] peer-focus:ring-2 peer-focus:ring-[var(--fd-maroon)]/20
              ${className}
            `}
          >
            <Upload className="h-5 w-5 shrink-0 text-[var(--neutral-400)]" />
            <div className="min-w-0 flex-1">
              {selectedFileName ? (
                <p className="truncate text-sm font-medium text-[var(--fd-ink)]">
                  {selectedFileName}
                </p>
              ) : (
                <p className="text-sm text-[var(--neutral-500)]">
                  Click to upload or drag and drop
                </p>
              )}
              {hint && <p className="text-xs text-[var(--neutral-400)]">{hint}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }
)
AdminFileInput.displayName = 'AdminFileInput'

/* ─────────────────────────────────────────────────────────────
   AdminButton
   ───────────────────────────────────────────────────────────── */

interface AdminButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  loading?: boolean
}

export function AdminButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: AdminButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center gap-2 font-medium rounded-lg
    transition-all duration-150 ease-out
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    disabled:cursor-not-allowed disabled:opacity-50
  `

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
  }

  const variantClasses = {
    primary: `
      bg-[var(--fd-maroon)] text-white
      hover:bg-[var(--fd-maroon-dark)] hover:-translate-y-0.5 hover:shadow-lg
      active:translate-y-0 active:shadow-md
      focus-visible:ring-[var(--fd-maroon)]
    `,
    secondary: `
      bg-[var(--neutral-100)] text-[var(--neutral-700)] border border-[var(--border-subtle)]
      hover:bg-[var(--neutral-200)] hover:-translate-y-0.5
      active:translate-y-0
      focus-visible:ring-[var(--neutral-400)]
    `,
    danger: `
      bg-white text-red-600 border border-[var(--border-subtle)]
      hover:bg-red-50 hover:border-red-200
      focus-visible:ring-red-500
    `,
    ghost: `
      text-[var(--neutral-600)]
      hover:bg-[var(--neutral-100)] hover:text-[var(--neutral-900)]
      focus-visible:ring-[var(--neutral-400)]
    `,
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   AdminCard
   ───────────────────────────────────────────────────────────── */

interface AdminCardProps {
  children: React.ReactNode
  className?: string
  highlight?: boolean
}

export function AdminCard({ children, className = '', highlight = false }: AdminCardProps) {
  return (
    <div
      className={`
        rounded-xl border bg-white p-4 shadow-sm
        transition-all duration-200
        ${highlight ? 'border-[var(--fd-maroon)] ring-1 ring-[var(--fd-maroon)]/10' : 'border-[var(--border-subtle)]'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   AdminCardTitle
   ───────────────────────────────────────────────────────────── */

export function AdminCardTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2 className={`mb-3 text-sm font-semibold text-[var(--fd-ink)] ${className}`}>{children}</h2>
  )
}

/* ─────────────────────────────────────────────────────────────
   AdminEmptyState
   ───────────────────────────────────────────────────────────── */

interface AdminEmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}

export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card-subtle)] px-6 py-12 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--neutral-100)]">
          <Icon className="h-6 w-6 text-[var(--neutral-400)]" />
        </div>
      )}
      <p className="text-sm font-medium text-[var(--neutral-600)]">{title}</p>
      {description && <p className="mt-1 text-xs text-[var(--neutral-400)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   AdminMessage (feedback toast-like)
   ───────────────────────────────────────────────────────────── */

type MessageType = 'success' | 'error' | 'info'

interface AdminMessageProps {
  type?: MessageType
  children: React.ReactNode
}

export function AdminMessage({ type = 'info', children }: AdminMessageProps) {
  const styles = {
    success: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      Icon: CheckCircle2,
    },
    error: {
      bg: '#fef2f2',
      border: '#fecaca',
      text: '#dc2626',
      Icon: XCircle,
    },
    info: {
      bg: 'var(--neutral-50)',
      border: 'var(--border-subtle)',
      text: 'var(--neutral-600)',
      Icon: Info,
    },
  }

  const { bg, border, text, Icon } = styles[type]

  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
      style={{ background: bg, borderColor: border, color: text }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   AdminBadge
   ───────────────────────────────────────────────────────────── */

interface AdminBadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
  style?: React.CSSProperties
}

export function AdminBadge({ children, variant = 'default', className = '', style }: AdminBadgeProps) {
  const variants = {
    default: 'bg-[var(--neutral-100)] text-[var(--neutral-600)]',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${variants[variant]} ${className}`}
      style={style}
    >
      {children}
    </span>
  )
}
