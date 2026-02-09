import type { Artwork } from '../../types/artwork'
import { ArtworkCard } from './ArtworkCard'
import { SkeletonCard } from './SkeletonCard'

interface ArtworkGridProps {
  artworks: Artwork[]
  loading: boolean
  onArtworkClick: (artwork: Artwork) => void
  isFavorited?: (objectid: number) => boolean
  onToggleFavorite?: (artwork: Artwork) => void
}

export function ArtworkGrid({ artworks, loading, onArtworkClick, isFavorited, onToggleFavorite }: ArtworkGridProps) {
  if (loading && artworks.length === 0) {
    return (
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 px-5"
        aria-busy="true"
        aria-live="polite"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (artworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-5">
        <p className="text-base text-text-secondary">No artworks found</p>
        <p className="mt-2 text-sm text-text-muted">Try a different search</p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 px-5"
      role="list"
      aria-label="Artwork gallery"
    >
      {artworks.map((artwork, i) => (
        <div key={artwork.objectid} role="listitem">
          <ArtworkCard
            artwork={artwork}
            onClick={onArtworkClick}
            isFavorited={isFavorited?.(artwork.objectid)}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(artwork) : undefined}
            animationDelay={i * 50}
          />
        </div>
      ))}
    </div>
  )
}
