import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { ApiError, api, setAuthTokenGetter } from '../lib/api'
import { identifyAnalyticsUser, resetAnalytics } from '../lib/analytics'
import { useBackendAvailabilityContext } from '../hooks/useBackendAvailability'
import type { CurrentUser } from '../lib/types'

export type AuthErrorKind = 'auth' | 'network' | null

type AuthContextValue = {
  isClerkEnabled: boolean
  isSignedIn: boolean
  isLoading: boolean
  user: CurrentUser | null
  error: string | null
  errorKind: AuthErrorKind
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const CLERK_JWT_TEMPLATE = import.meta.env.VITE_CLERK_JWT_TEMPLATE as string | undefined

export function useAuthContext() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuthContext must be used within AuthProvider')
  return value
}

export function AuthProvider({ children, isClerkEnabled }: { children: ReactNode; isClerkEnabled: boolean }) {
  if (isClerkEnabled) return <ClerkBackedAuthProvider>{children}</ClerkBackedAuthProvider>
  return <ClerkRequiredAuthProvider>{children}</ClerkRequiredAuthProvider>
}

function ClerkRequiredAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setAuthTokenGetter(null)
    return () => setAuthTokenGetter(null)
  }, [])

  const refreshUser = useCallback(async () => {}, [])

  const value = useMemo<AuthContextValue>(() => ({
    isClerkEnabled: false,
    isSignedIn: false,
    isLoading: false,
    user: null,
    error: 'Clerk is not configured. Add VITE_CLERK_PUBLISHABLE_KEY before using admin routes.',
    errorKind: 'auth',
    refreshUser,
  }), [refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ClerkBackedAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const backend = useBackendAvailabilityContext()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<AuthErrorKind>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken(CLERK_JWT_TEMPLATE ? { template: CLERK_JWT_TEMPLATE } : undefined)
      } catch {
        return null
      }
    })
    return () => setAuthTokenGetter(null)
  }, [getToken])

  const refreshUser = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setUser(null)
      setError(null)
      setErrorKind(null)
      resetAnalytics()
      return
    }

    setIsChecking(true)
    setError(null)
    setErrorKind(null)
    try {
      const response = await api.getCurrentUser()
      setUser(response.user)
      identifyAnalyticsUser(response.user)
      backend.reportAvailable()
    } catch (err) {
      setUser(null)
      resetAnalytics()
      const isNetworkOrServerFailure = !(err instanceof ApiError) || err.status >= 500
      if (isNetworkOrServerFailure) {
        backend.reportUnavailable()
        setErrorKind('network')
        setError('Unable to reach the FD Alumni Hub API. Try again once the server is online.')
      } else {
        setErrorKind('auth')
        setError(err.message || 'Unable to verify user')
      }
    } finally {
      setIsChecking(false)
    }
  }, [isLoaded, isSignedIn, backend.reportAvailable, backend.reportUnavailable])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser, clerkUser?.id])

  const value = useMemo<AuthContextValue>(() => ({
    isClerkEnabled: true,
    isSignedIn: Boolean(isSignedIn),
    isLoading: !isLoaded || isChecking,
    user,
    error,
    errorKind,
    refreshUser,
  }), [isLoaded, isSignedIn, isChecking, user, error, errorKind, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
