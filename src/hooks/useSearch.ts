import { useState, useCallback, useRef, useEffect } from 'react'
import { searchArtworks } from '../api/search'
import { useSessionId } from './useSessionId'
import type { Artwork, SearchResponse } from '../types/artwork'

export function useSearch() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionId = useSessionId()
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const search = useCallback(async (query: string) => {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) {
      setArtworks([])
      setError(null)
      setLoading(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    setLoading(true)
    setError(null)
    try {
      const response: SearchResponse = await searchArtworks(normalizedQuery, {
        sessionId,
        signal: controller.signal,
      })
      if (requestId !== requestIdRef.current) {
        return
      }
      setArtworks(response.results ?? [])
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return
      }
      setError(err instanceof Error ? err.message : 'Search failed')
      setArtworks([])
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [sessionId])

  const loadInitial = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current

    setLoading(true)
    setError(null)
    try {
      const response: SearchResponse = await searchArtworks('paintings', {
        sessionId,
        signal: controller.signal,
      })
      if (requestId !== requestIdRef.current) {
        return
      }
      setArtworks(response.results ?? [])
    } catch (err) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return
      }
      setError(err instanceof Error ? err.message : 'Failed to load artworks')
      setArtworks([])
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [sessionId])

  return { artworks, loading, error, search, loadInitial }
}
