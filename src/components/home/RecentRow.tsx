import { HorizontalScroll } from '../shared/HorizontalScroll'
import type { Artwork } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface RecentRowProps {
  artworks: Artwork[]
  onArtworkClick: (artwork: Artwork) => void
  onSeeAll: () => void
}

export function RecentRow({ artworks, onArtworkClick, onSeeAll }: RecentRowProps) {
  if (artworks.length === 0) return null

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-5 mb-3">
        <h3 className="text-lg font-bold text-text-primary">Check out more</h3>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-xs text-accent font-medium hover:text-accent-light transition-colors"
          aria-label="See all artworks in Discover"
        >
          See all
        </button>
      </div>
      <HorizontalScroll>
        {artworks.map((artwork) => {
          const rawThumb = artwork.images?.[0]?.iiifthumburl || artwork.iiifthumburl
          const thumbUrl = rawThumb ? getHighResUrl(rawThumb) : undefined
          return (
            <button
              key={artwork.objectid}
              onClick={() => onArtworkClick(artwork)}
              className="flex-shrink-0 snap-start w-36 sm:w-44 group cursor-pointer"
              aria-label={`View ${artwork.title}`}
            >
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-surface-card">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={artwork.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-text-muted text-xs">No image</span>
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-text-secondary line-clamp-1 text-left">{artwork.title}</p>
              <p className="text-[10px] text-text-muted line-clamp-1 text-left">{artwork.attribution}</p>
            </button>
          )
        })}
      </HorizontalScroll>
    </section>
  )
}
