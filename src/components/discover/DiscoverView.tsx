import { useState, useEffect, useCallback, useRef } from 'react'
import { MasonryGrid } from './MasonryGrid'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { discoverArtworksPage, searchArtworks } from '../../api/search'
import type { Artwork, CollectionResponse } from '../../types/artwork'

const DISCOVER_QUERIES = [
  'paintings',
  'landscapes nature',
  'portraits faces',
  'impressionism light',
  'sculptures marble',
  'modern abstract',
  'renaissance classical',
  'still life flowers',
  'watercolor drawings',
  'photography prints',
]
const PAGE_SIZE = 40

type DiscoverMode = 'catalog' | 'fallback'

interface DiscoverViewProps {
  onArtworkClick: (artwork: Artwork) => void
  isFavorited: (objectid: number) => boolean
  onToggleFavorite: (artwork: Artwork) => void
}

export function DiscoverView({ onArtworkClick, isFavorited, onToggleFavorite }: DiscoverViewProps) {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [mode, setMode] = useState<DiscoverMode>('catalog')
  const [showCatalogFallbackNotice, setShowCatalogFallbackNotice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const queryIndexRef = useRef(0)
  const seenIdsRef = useRef(new Set<number>())
  const offsetRef = useRef(0)
  const [hasMore, setHasMore] = useState(true)

  const appendUniqueArtworks = useCallback((incoming: Artwork[]) => {
    const uniqueIncoming: Artwork[] = []
    for (const artwork of incoming) {
      if (seenIdsRef.current.has(artwork.objectid)) continue
      seenIdsRef.current.add(artwork.objectid)
      uniqueIncoming.push(artwork)
    }
    if (uniqueIncoming.length > 0) {
      setArtworks((prev) => [...prev, ...uniqueIncoming])
    }
    return uniqueIncoming.length
  }, [])

  const loadCatalogPage = useCallback(async () => {
    const offset = offsetRef.current
    const response: CollectionResponse = await discoverArtworksPage({
      limit: PAGE_SIZE,
      offset,
    })

    const pageResults = response.results ?? []
    const appendedCount = appendUniqueArtworks(pageResults)
    const explicitNextOffset =
      typeof response.nextOffset === 'number' ? response.nextOffset : null
    const explicitHasMore =
      typeof response.hasMore === 'boolean' ? response.hasMore : null

    // Guard for endpoints that ignore pagination and keep returning page 1.
    if (offset > 0 && pageResults.length > 0 && appendedCount === 0) {
      throw new Error('Catalog endpoint does not support pagination')
    }

    offsetRef.current =
      explicitNextOffset ?? offset + pageResults.length

    const nextHasMore =
      explicitHasMore ?? pageResults.length === PAGE_SIZE
    setHasMore(nextHasMore && pageResults.length > 0)
  }, [appendUniqueArtworks])

  const loadFallbackBatch = useCallback(async () => {
    if (queryIndexRef.current >= DISCOVER_QUERIES.length) {
      setHasMore(false)
      return
    }

    const query = DISCOVER_QUERIES[queryIndexRef.current]
    queryIndexRef.current += 1
    const response = await searchArtworks(query)
    appendUniqueArtworks(response.results ?? [])
    setHasMore(queryIndexRef.current < DISCOVER_QUERIES.length)
  }, [appendUniqueArtworks])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (mode === 'catalog') {
        try {
          await loadCatalogPage()
        } catch {
          // Automatic fallback keeps Discover usable while backend pagination is rolling out.
          setMode('fallback')
          setShowCatalogFallbackNotice(true)
          setHasMore(true)
          queryIndexRef.current = 0
          await loadFallbackBatch()
        }
      } else {
        await loadFallbackBatch()
      }
    } catch {
      setError('Unable to load more artworks right now.')
      setHasMore(false)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [hasMore, loadCatalogPage, loadFallbackBatch, loading, mode])

  useEffect(() => {
    loadMore()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading)

  if (initialLoading) {
    return (
      <div className="px-5 space-y-3">
        <p className="text-sm text-text-muted mb-4">Explore art culture and stories</p>
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`break-inside-avoid mb-3 rounded-2xl animate-shimmer ${
                ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-[2/3]', 'aspect-[5/6]'][i % 4]
              }`}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-text-muted px-5 mb-4">
        {mode === 'catalog'
          ? 'Explore the full collection'
          : 'Explore art culture and stories'}
      </p>
      {showCatalogFallbackNotice && (
        <p className="text-xs text-text-muted px-5 mb-4">
          Full-catalog pagination is unavailable; showing curated discovery highlights.
        </p>
      )}
      {error && (
        <div
          className="mx-5 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
      <MasonryGrid
        artworks={artworks}
        onArtworkClick={onArtworkClick}
        isFavorited={isFavorited}
        onToggleFavorite={onToggleFavorite}
      />

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-10" />

      {loading && !initialLoading && (
        <div className="flex justify-center py-6">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {!hasMore && artworks.length > 0 && (
        <p className="text-center text-sm text-text-muted py-8">
          {mode === 'catalog'
            ? "You've explored the full collection"
            : "You've reached the end of discovery highlights"}
        </p>
      )}
    </div>
  )
}
