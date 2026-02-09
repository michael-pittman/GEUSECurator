import { useState, useEffect, useCallback, useRef } from 'react'
import { MasonryGrid } from './MasonryGrid'
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll'
import { searchArtworks } from '../../api/search'
import type { Artwork } from '../../types/artwork'

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

interface DiscoverViewProps {
  onArtworkClick: (artwork: Artwork) => void
  isFavorited: (objectid: number) => boolean
  onToggleFavorite: (artwork: Artwork) => void
}

export function DiscoverView({ onArtworkClick, isFavorited, onToggleFavorite }: DiscoverViewProps) {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const queryIndexRef = useRef(0)
  const seenIdsRef = useRef(new Set<number>())
  const [hasMore, setHasMore] = useState(true)

  const loadMore = useCallback(async () => {
    if (loading || queryIndexRef.current >= DISCOVER_QUERIES.length) {
      setHasMore(false)
      return
    }

    setLoading(true)
    try {
      const query = DISCOVER_QUERIES[queryIndexRef.current]
      queryIndexRef.current += 1
      const response = await searchArtworks(query)
      const newResults = (response.results ?? []).filter((a) => {
        if (seenIdsRef.current.has(a.objectid)) return false
        seenIdsRef.current.add(a.objectid)
        return true
      })
      setArtworks((prev) => [...prev, ...newResults])
      if (queryIndexRef.current >= DISCOVER_QUERIES.length) {
        setHasMore(false)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [loading])

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
      <p className="text-sm text-text-muted px-5 mb-4">Explore art culture and stories</p>
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
        <p className="text-center text-sm text-text-muted py-8">You've explored the full collection</p>
      )}
    </div>
  )
}
