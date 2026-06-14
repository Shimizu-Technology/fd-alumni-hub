import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { api, setAuthTokenGetter } from '../lib/api'
import type { CurrentUser } from '../lib/types'

type AuthContextValue = {
  isClerkEnabled: boolean
  isSignedIn: boolean
  isLoading: boolean
  user: CurrentUser | null
  error: string | null
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

  const refreshUser = async () => {}

  const value = useMemo<AuthContextValue>(() => ({
    isClerkEnabled: false,
    isSignedIn: false,
    isLoading: false,
    user: null,
    error: 'Clerk is not configured. Add VITE_CLERK_PUBLISHABLE_KEY before using admin routes.',
    refreshUser,
  }), [])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ClerkBackedAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  const refreshUser = async () => {
    if (!isLoaded || !isSignedIn) {
      setUser(null)
      return
    }

    setIsChecking(true)
    setError(null)
    try {
      const response = await api.getCurrentUser()
      setUser(response.user)
    } catch (err) {
      setUser(null)
      setError(err instanceof Error ? err.message : 'Unable to verify user')
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    void refreshUser()
  }, [isLoaded, isSignedIn, clerkUser?.id])

  const value = useMemo<AuthContextValue>(() => ({
    isClerkEnabled: true,
    isSignedIn: Boolean(isSignedIn),
    isLoading: !isLoaded || isChecking,
    user,
    error,
    refreshUser,
  }), [isLoaded, isSignedIn, isChecking, user, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
