import { useSearch } from '../../hooks/useSearch'
import { SearchBar } from './SearchBar'
import { SearchResults } from './SearchResults'
import type { Artwork } from '../../types/artwork'

interface SearchViewProps {
  onArtworkClick: (artwork: Artwork) => void
  isFavorited: (objectid: number) => boolean
  onToggleFavorite: (artwork: Artwork) => void
}

export function SearchView({ onArtworkClick, isFavorited, onToggleFavorite }: SearchViewProps) {
  const { artworks, loading, error, search } = useSearch()

  return (
    <div>
      <SearchBar onSearch={search} loading={loading} />

      {error && (
        <div className="mx-5 mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}

      <SearchResults
        artworks={artworks}
        loading={loading}
        onArtworkClick={onArtworkClick}
        isFavorited={isFavorited}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  )
}
