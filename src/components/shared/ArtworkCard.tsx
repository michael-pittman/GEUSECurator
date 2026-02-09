import type { Artwork } from '../../types/artwork'
import { HeartButton } from './HeartButton'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface ArtworkCardProps {
  artwork: Artwork
  onClick: (artwork: Artwork) => void
  isFavorited?: boolean
  onToggleFavorite?: () => void
  animationDelay?: number
}

export function ArtworkCard({ artwork, onClick, isFavorited, onToggleFavorite, animationDelay }: ArtworkCardProps) {
  const rawThumbUrl = artwork.images?.[0]?.iiifthumburl || artwork.iiifthumburl
  const thumbUrl = rawThumbUrl ? getHighResUrl(rawThumbUrl) : undefined
  const altText = artwork.images?.[0]?.assistivetext || artwork.title

  return (
    <div
      className="animate-fade-in-up"
      style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      <button
        onClick={() => onClick(artwork)}
        className="group relative w-full aspect-[3/4] overflow-hidden rounded-2xl bg-surface-card cursor-pointer transition-all duration-300 ease-out hover:scale-[1.02] hover:shadow-2xl hover:shadow-accent-glow/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
        aria-label={`View details for ${artwork.title} by ${artwork.attribution}`}
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={altText}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-card">
            <span className="text-text-secondary text-sm">No image</span>
          </div>
        )}

        {/* Heart button */}
        {onToggleFavorite && (
          <div className="absolute top-2 right-2 z-10">
            <HeartButton
              isFavorited={isFavorited ?? false}
              onToggle={onToggleFavorite}
              size="sm"
            />
          </div>
        )}

        {/* Glass overlay on hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0">
          <div className="backdrop-blur-xl bg-glass-warm-strong border-t border-glass-border p-3">
            <h3 className="text-xs sm:text-sm font-medium text-text-primary line-clamp-2 leading-tight">
              {artwork.title}
            </h3>
            <p className="mt-1 text-[10px] sm:text-xs text-text-secondary line-clamp-1">
              {artwork.attribution}
            </p>
            {artwork.displaydate && (
              <p className="mt-0.5 text-[10px] sm:text-xs text-text-muted">
                {artwork.displaydate}
              </p>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
