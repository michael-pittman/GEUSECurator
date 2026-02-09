import { HorizontalScroll } from '../shared/HorizontalScroll'
import type { Artwork } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface FeaturedRowProps {
  artworks: Artwork[]
  onArtworkClick: (artwork: Artwork) => void
}

export function FeaturedRow({ artworks, onArtworkClick }: FeaturedRowProps) {
  if (artworks.length === 0) return null

  return (
    <section className="mt-6">
      <h3 className="text-xl font-bold text-text-primary px-5 mb-3">
        Today's Art Highlight
      </h3>
      <HorizontalScroll>
        {artworks.slice(0, 5).map((artwork) => {
          const rawThumb = artwork.images?.[0]?.iiifthumburl || artwork.iiifthumburl
          const thumbUrl = rawThumb ? getHighResUrl(rawThumb) : undefined
          return (
            <button
              key={artwork.objectid}
              onClick={() => onArtworkClick(artwork)}
              className="flex-shrink-0 snap-start w-48 sm:w-56 group cursor-pointer"
              aria-label={`View ${artwork.title}`}
            >
              <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-surface-card">
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
            </button>
          )
        })}
      </HorizontalScroll>
    </section>
  )
}
