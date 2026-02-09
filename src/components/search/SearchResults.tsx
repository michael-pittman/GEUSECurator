import type { Artwork } from '../../types/artwork'
import { ArtworkGrid } from '../shared/ArtworkGrid'

interface SearchResultsProps {
  artworks: Artwork[]
  loading: boolean
  onArtworkClick: (artwork: Artwork) => void
  isFavorited: (objectid: number) => boolean
  onToggleFavorite: (artwork: Artwork) => void
}

export function SearchResults({ artworks, loading, onArtworkClick, isFavorited, onToggleFavorite }: SearchResultsProps) {
  return (
    <div className="mt-4">
      {artworks.length > 0 && !loading && (
        <p className="text-xs text-text-muted px-5 mb-3">{artworks.length} result{artworks.length !== 1 ? 's' : ''}</p>
      )}
      <ArtworkGrid
        artworks={artworks}
        loading={loading}
        onArtworkClick={onArtworkClick}
        isFavorited={isFavorited}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  )
}
