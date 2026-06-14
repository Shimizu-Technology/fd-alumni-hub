import type { CurrentUser } from './types'

type AnalyticsProps = Record<string, string | number | boolean | null | undefined>
type PostHogClient = typeof import('posthog-js').default

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export const isAnalyticsEnabled = Boolean(posthogKey) &&
  (import.meta.env.PROD || import.meta.env.VITE_ENABLE_ANALYTICS_IN_DEV === 'true')

let posthogPromise: Promise<PostHogClient | null> | null = null
let initialized = false

function compactProps(props: AnalyticsProps = {}) {
  return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))
}

function routeArea(pathname: string) {
  if (pathname.startsWith('/admin')) return 'admin'
  if (['/schedule', '/standings', '/watch'].includes(pathname)) return 'tournament'
  if (['/news', '/gallery', '/sponsors', '/history'].includes(pathname)) return 'coverage'
  if (pathname === '/') return 'home'
  return 'other'
}

async function getPostHog() {
  if (!isAnalyticsEnabled || !posthogKey || typeof window === 'undefined') return null

  posthogPromise ||= import('posthog-js').then(({ default: posthog }) => {
    if (!initialized) {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        defaults: '2025-11-30',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        disable_session_recording: false,
        session_recording: {
          maskAllInputs: true,
        },
      })
      initialized = true
    }

    return posthog
  }).catch(() => null)

  return posthogPromise
}

export function initializeAnalytics() {
  if (!isAnalyticsEnabled) {
    if (import.meta.env.DEV) console.info('PostHog not configured - analytics disabled')
    return
  }

  void getPostHog()
}

export function captureAnalyticsEvent(event: string, props: AnalyticsProps = {}) {
  if (!isAnalyticsEnabled) return

  void getPostHog().then((posthog) => {
    posthog?.capture(event, compactProps(props))
  })
}

export function capturePageview(pathname: string, search: string) {
  if (!isAnalyticsEnabled || typeof window === 'undefined') return

  captureAnalyticsEvent('$pageview', {
    $current_url: window.location.href,
    $pathname: pathname,
    route_area: routeArea(pathname),
    has_query: search.length > 0,
  })
}

export function identifyAnalyticsUser(user: CurrentUser) {
  if (!isAnalyticsEnabled) return

  void getPostHog().then((posthog) => {
    posthog?.identify(`fd-admin:${user.id}`, compactProps({
      app_role: user.role,
      is_admin: user.isAdmin,
      is_staff: user.isStaff,
    }))
  })
}

export function resetAnalytics() {
  if (!isAnalyticsEnabled) return

  void getPostHog().then((posthog) => {
    posthog?.reset()
  })
}
