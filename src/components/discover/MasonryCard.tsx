import type { Artwork } from '../../types/artwork'
import { HeartButton } from '../shared/HeartButton'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

const aspectRatios = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-[2/3]', 'aspect-[5/6]', 'aspect-[3/5]']

interface MasonryCardProps {
  artwork: Artwork
  index: number
  onClick: (artwork: Artwork) => void
  isFavorited: boolean
  onToggleFavorite: () => void
}

export function MasonryCard({ artwork, index, onClick, isFavorited, onToggleFavorite }: MasonryCardProps) {
  const rawThumbUrl = artwork.images?.[0]?.iiifthumburl || artwork.iiifthumburl
  const thumbUrl = rawThumbUrl ? getHighResUrl(rawThumbUrl) : undefined
  const aspectClass = aspectRatios[index % aspectRatios.length]

  return (
    <div
      className="break-inside-avoid mb-3 animate-fade-in-up"
      style={{ animationDelay: `${(index % 10) * 60}ms` }}
    >
      <button
        onClick={() => onClick(artwork)}
        className={`group relative w-full ${aspectClass} overflow-hidden rounded-2xl bg-surface-card cursor-pointer transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]`}
        aria-label={`View ${artwork.title} by ${artwork.attribution}`}
      >
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

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <HeartButton isFavorited={isFavorited} onToggle={onToggleFavorite} size="sm" />
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-xs font-medium text-white line-clamp-2">{artwork.title}</p>
        </div>
      </button>
    </div>
  )
}
