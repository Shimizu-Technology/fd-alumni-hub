import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { ApiError } from './api'

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  errorStatus: number | null
  reload: () => Promise<void>
}

export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const loaderRef = useRef(loader)
  const requestIdRef = useRef(0)

  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setErrorStatus(null)
    try {
      const result = await loaderRef.current()
      if (requestId === requestIdRef.current) setData(result)
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setErrorStatus(err instanceof ApiError ? err.status : null)
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    void reload()
    return () => {
      requestIdRef.current += 1
    }
  }, [reload])

  return { data, loading, error, errorStatus, reload }
}
