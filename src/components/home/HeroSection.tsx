import type { Artwork } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface HeroSectionProps {
  artwork: Artwork | null
}

export function HeroSection({ artwork }: HeroSectionProps) {
  const rawThumbUrl = artwork?.images?.[0]?.iiifthumburl || artwork?.iiifthumburl
  const bgUrl = rawThumbUrl ? getHighResUrl(rawThumbUrl) : undefined

  return (
    <div className="relative mx-5 rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[16/9] max-h-[500px]">
      {bgUrl && (
        <img
          src={bgUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-surface-dark/60 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
        <h2 className="text-3xl sm:text-5xl font-bold text-text-primary leading-tight">
          Hello Art<br />Lover
        </h2>
        <p className="mt-3 text-sm sm:text-base text-text-secondary max-w-md leading-relaxed">
          Explore the National Gallery of Art's collection through immersive digital gallery journeys.
        </p>
      </div>
    </div>
  )
}
