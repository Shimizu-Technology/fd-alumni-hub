import { useEffect, useState } from 'react'

function readMotionPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useMotionOk(): boolean {
  const [motionOk, setMotionOk] = useState<boolean>(readMotionPreference)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setMotionOk(!query.matches)
    sync()

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', sync)
      return () => query.removeEventListener('change', sync)
    }

    query.addListener(sync)
    return () => query.removeListener(sync)
  }, [])

  return motionOk
}
