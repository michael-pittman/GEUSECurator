import type { Artwork } from '../types/artwork'
import { ArtworkCard } from './ArtworkCard'
import { SkeletonCard } from './SkeletonCard'

interface ArtworkGridProps {
  artworks: Artwork[]
  loading: boolean
  onArtworkClick: (artwork: Artwork) => void
}

export function ArtworkGrid({ artworks, loading, onArtworkClick }: ArtworkGridProps) {
  if (loading) {
    return (
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (artworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
        <p className="text-base sm:text-lg text-text-secondary">No artworks found</p>
        <p className="mt-2 text-sm text-text-secondary/60">Try a different search or adjust your filters</p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
      role="list"
      aria-label="Artwork gallery"
    >
      {artworks.map((artwork) => (
        <div key={artwork.objectid} role="listitem">
          <ArtworkCard
            artwork={artwork}
            onClick={onArtworkClick}
          />
        </div>
      ))}
    </div>
  )
}
