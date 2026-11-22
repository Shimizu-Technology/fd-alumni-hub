import { useEffect, useRef } from 'react'

const MODAL_FOCUSABLE = [
  'a[href]',
  'summary',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const MAX_DOLLARS = 1_000_000_000 // $1B cap matching backend MAX_CENTS
const DOLLAR_REGEX = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/

export function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function parseDollarsToCents(raw: string, { positive = false }: { positive?: boolean } = {}): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim().replace(/^\$\s*/, '')
  if (!trimmed || !DOLLAR_REGEX.test(trimmed)) {
    return { ok: false, error: 'Enter a valid dollar amount (for example, 250, 1,250.00, or 250.50).' }
  }
  const parsed = Number(trimmed.replace(/,/g, ''))
  if (!Number.isFinite(parsed) || parsed > MAX_DOLLARS || (positive ? parsed <= 0 : parsed < 0)) {
    return { ok: false, error: positive ? 'Amount must be greater than $0 and within range.' : 'Amount must be non-negative and within range.' }
  }
  return { ok: true, value: Math.round(parsed * 100) }
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}

export function todayIsoDate() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Pacific/Guam' }).format(new Date())
}

export function useAccessibleModal(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>, initialFocusRef: React.RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef.current) initialFocusRef.current.focus({ preventScroll: true })
      else panelRef.current?.focus({ preventScroll: true })
    }, 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE) || []).filter((element) => !element.closest('details:not([open])') || element.matches('summary'))
      if (focusable.length === 0) {
        event.preventDefault()
        panelRef.current?.focus({ preventScroll: true })
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [open, panelRef, initialFocusRef])
}
