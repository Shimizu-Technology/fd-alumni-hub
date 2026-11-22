import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useBackendAvailabilityContext } from '../hooks/useBackendAvailability'
import { api } from '../lib/api'
import { offlineSiteMode, type SiteMode } from '../lib/siteMode'
import type { TournamentAlert } from '../lib/types'

type Payload = { siteMode: SiteMode; alerts?: TournamentAlert[] }

const SiteModeContext = createContext({
  siteMode: offlineSiteMode,
  alerts: [] as TournamentAlert[],
  acceptSiteMode: (_payload: Payload) => {},
})

export function SiteModeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { status } = useBackendAvailabilityContext()
  const [resolved, setResolved] = useState<SiteMode | null>(null)
  const [alerts, setAlerts] = useState<TournamentAlert[]>([])
  const acceptSiteMode = useCallback(({ siteMode, alerts }: Payload) => {
    if (siteMode) setResolved(siteMode)
    if (alerts) setAlerts(alerts)
  }, [])

  const needsSiteMode = pathname !== '/' && !resolved
  useEffect(() => {
    if (status !== 'available' || !needsSiteMode) return

    let active = true
    api.publicSiteMode().then((payload) => {
      if (active) acceptSiteMode(payload)
    }).catch(() => {})
    return () => { active = false }
  }, [acceptSiteMode, needsSiteMode, status])

  useEffect(() => {
    if (status !== 'available') return

    let active = true
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      api.publicAlerts().then(({ alerts }) => {
        if (active) setAlerts(alerts)
      }).catch(() => {})
    }
    const interval = window.setInterval(refresh, 45_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [status])

  return (
    <SiteModeContext.Provider value={{ siteMode: resolved || offlineSiteMode, alerts, acceptSiteMode }}>
      {children}
    </SiteModeContext.Provider>
  )
}

export function useSiteMode() {
  return useContext(SiteModeContext)
}
