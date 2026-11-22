import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type BackendAvailability = 'checking' | 'available' | 'unavailable'

export type BackendAvailabilityContextValue = {
  status: BackendAvailability
  isChecking: boolean
  isUnavailable: boolean
  retry: () => Promise<void>
  reportUnavailable: () => void
  reportAvailable: () => void
}

const PROBE_TIMEOUT_MS = 5_000
const RETRY_INTERVAL_MS = 30_000

const BackendAvailabilityContext = createContext<BackendAvailabilityContextValue | null>(null)

export function useBackendAvailability(healthUrl: string) {
  const [status, setStatus] = useState<BackendAvailability>('checking')
  const requestId = useRef(0)

  const check = useCallback(async (showChecking = true) => {
    const currentRequest = ++requestId.current
    if (showChecking) setStatus('checking')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

    try {
      const response = await fetch(healthUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/json, text/plain' },
        signal: controller.signal,
      })
      if (requestId.current === currentRequest) setStatus(response.ok ? 'available' : 'unavailable')
    } catch {
      if (requestId.current === currentRequest) setStatus('unavailable')
    } finally {
      window.clearTimeout(timeout)
    }
  }, [healthUrl])

  useEffect(() => {
    void check()
    return () => { requestId.current += 1 }
  }, [check])

  useEffect(() => {
    if (status !== 'unavailable') return
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void check(false)
    }, RETRY_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [check, status])

  const reportUnavailable = useCallback(() => {
    requestId.current += 1
    setStatus('unavailable')
  }, [])

  const reportAvailable = useCallback(() => {
    requestId.current += 1
    setStatus('available')
  }, [])

  const retry = useCallback(() => check(true), [check])

  return {
    status,
    isChecking: status === 'checking',
    isUnavailable: status === 'unavailable',
    retry,
    reportUnavailable,
    reportAvailable,
  }
}

export function BackendAvailabilityProvider({ healthUrl, children }: { healthUrl: string; children: ReactNode }) {
  const availability = useBackendAvailability(healthUrl)
  const value = useMemo(() => availability, [
    availability.status,
    availability.isChecking,
    availability.isUnavailable,
    availability.retry,
    availability.reportUnavailable,
    availability.reportAvailable,
  ])

  return createElement(BackendAvailabilityContext.Provider, { value }, children)
}

export function useBackendAvailabilityContext(): BackendAvailabilityContextValue {
  const value = useContext(BackendAvailabilityContext)
  if (!value) {
    throw new Error('useBackendAvailabilityContext must be used within BackendAvailabilityProvider')
  }
  return value
}
