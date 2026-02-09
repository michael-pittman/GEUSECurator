import { EmptyFavorites } from './EmptyFavorites'
import type { Artwork, FavoriteEntry } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface FavoritesViewProps {
  favorites: FavoriteEntry[]
  onArtworkClick: (artwork: Artwork) => void
  onRemoveFavorite: (artwork: Artwork) => void
  onExplore: () => void
}

export function FavoritesView({ favorites, onArtworkClick, onRemoveFavorite, onExplore }: FavoritesViewProps) {
  if (favorites.length === 0) {
    return <EmptyFavorites onExplore={onExplore} />
  }

  return (
    <div className="px-5">
      <p className="text-xs text-text-muted mb-4">{favorites.length} saved artwork{favorites.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {favorites.map((fav) => {
          const thumbUrl = fav.iiifthumburl ? getHighResUrl(fav.iiifthumburl) : undefined
          const syntheticArtwork: Artwork = {
            objectid: fav.objectid,
            title: fav.title,
            attribution: fav.attribution,
            displaydate: '',
            medium: '',
            classification: '',
            beginyear: null,
            endyear: null,
            creditline: '',
            images: fav.iiifthumburl
              ? [{ uuid: '', iiifurl: '', iiifthumburl: fav.iiifthumburl, viewtype: 'primary', sequence: 0, width: 0, height: 0, assistivetext: fav.title }]
              : [],
          }

          return (
            <div key={fav.objectid} className="animate-fade-in-up">
              <button
                onClick={() => onArtworkClick(syntheticArtwork)}
                className="group relative w-full aspect-[3/4] overflow-hidden rounded-2xl bg-surface-card cursor-pointer"
                aria-label={`View ${fav.title}`}
              >
                {thumbUrl ? (
                  <img src={thumbUrl} alt={fav.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-text-muted text-xs">No image</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-xs font-medium text-white line-clamp-2">{fav.title}</p>
                  <p className="text-[10px] text-white/70 line-clamp-1">{fav.attribution}</p>
                </div>
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveFavorite(syntheticArtwork)
                  }}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-surface-dark/60 backdrop-blur-xl text-accent"
                  aria-label={`Remove ${fav.title} from favorites`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
