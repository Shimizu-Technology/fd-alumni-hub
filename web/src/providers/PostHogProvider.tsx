import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { capturePageview, initializeAnalytics } from '../lib/analytics'

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initializeAnalytics()
  }, [])

  return <>{children}</>
}

export function PostHogPageView() {
  const location = useLocation()

  useEffect(() => {
    capturePageview(location.pathname, location.search)
  }, [location.pathname, location.search])

  return null
}
