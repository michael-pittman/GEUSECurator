import type { Artwork } from '../../types/artwork'
import { MasonryCard } from './MasonryCard'

interface MasonryGridProps {
  artworks: Artwork[]
  onArtworkClick: (artwork: Artwork) => void
  isFavorited: (objectid: number) => boolean
  onToggleFavorite: (artwork: Artwork) => void
}

export function MasonryGrid({ artworks, onArtworkClick, isFavorited, onToggleFavorite }: MasonryGridProps) {
  return (
    <div
      className="columns-2 sm:columns-3 lg:columns-4 gap-3 px-5"
      role="list"
      aria-label="Artwork gallery"
    >
      {artworks.map((artwork, i) => (
        <div key={artwork.objectid} role="listitem">
          <MasonryCard
            artwork={artwork}
            index={i}
            onClick={onArtworkClick}
            isFavorited={isFavorited(artwork.objectid)}
            onToggleFavorite={() => onToggleFavorite(artwork)}
          />
        </div>
      ))}
    </div>
  )
}
