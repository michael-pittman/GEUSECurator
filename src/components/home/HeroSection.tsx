import { useEffect, useMemo, useState } from 'react'
import type { Artwork, FavoriteEntry } from '../../types/artwork'

function getHighResUrl(thumbUrl: string): string {
  return thumbUrl.replace(/\/full\/!?\d+,\d+\//, '/full/!600,600/')
}

interface HeroSectionProps {
  artwork: Artwork | null
  favorites: FavoriteEntry[]
}

interface HeroSlide {
  key: string
  bgUrl: string
  title: string
  attribution: string
}

export function HeroSection({ artwork, favorites }: HeroSectionProps) {
  const rawThumbUrl = artwork?.images?.[0]?.iiifthumburl || artwork?.iiifthumburl
  const bgUrl = rawThumbUrl ? getHighResUrl(rawThumbUrl) : undefined
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  const favoriteSlides = useMemo<HeroSlide[]>(() => {
    return favorites
      .filter(
        (favorite): favorite is FavoriteEntry & { iiifthumburl: string } =>
          typeof favorite.iiifthumburl === 'string' && favorite.iiifthumburl.length > 0
      )
      .map((favorite) => ({
        key: `favorite-${favorite.objectid}`,
        bgUrl: getHighResUrl(favorite.iiifthumburl),
        title: favorite.title,
        attribution: favorite.attribution,
      }))
  }, [favorites])

  const heroSlides = useMemo<HeroSlide[]>(() => {
    if (favoriteSlides.length > 0) {
      return favoriteSlides
    }

    if (!bgUrl) {
      return []
    }

    return [
      {
        key: `featured-${artwork?.objectid ?? 0}`,
        bgUrl,
        title: artwork?.title || '',
        attribution: artwork?.attribution || '',
      },
    ]
  }, [favoriteSlides, bgUrl, artwork?.objectid, artwork?.title, artwork?.attribution])

  const showingFavoritesShowcase = favoriteSlides.length > 0
  const normalizedSlideIndex =
    heroSlides.length > 0 ? activeSlideIndex % heroSlides.length : 0
  const activeSlide = heroSlides[normalizedSlideIndex] ?? null

  useEffect(() => {
    if (!showingFavoritesShowcase || heroSlides.length < 2) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % heroSlides.length)
    }, 4500)

    return () => window.clearInterval(intervalId)
  }, [heroSlides.length, showingFavoritesShowcase])

  return (
    <div className="relative mx-5 rounded-3xl overflow-hidden aspect-[3/4] sm:aspect-[16/9] max-h-[500px]">
      {heroSlides.map((slide, index) => (
        <img
          key={slide.key}
          src={slide.bgUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            index === normalizedSlideIndex ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden="true"
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-dark via-surface-dark/60 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
        {showingFavoritesShowcase ? (
          <>
            <h2 className="text-3xl sm:text-5xl font-bold text-text-primary leading-tight">
              Your Saved<br />Collection
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary max-w-md leading-relaxed">
              A rotating hero slideshow from your favorites.
            </p>
            {activeSlide && (
              <div className="mt-4">
                <p className="text-sm sm:text-base font-medium text-text-primary line-clamp-1">
                  {activeSlide.title}
                </p>
                <p className="text-xs sm:text-sm text-text-secondary line-clamp-1">
                  {activeSlide.attribution}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h2 className="text-3xl sm:text-5xl font-bold text-text-primary leading-tight">
              Hello Art<br />Lover
            </h2>
            <p className="mt-3 text-sm sm:text-base text-text-secondary max-w-md leading-relaxed">
              Explore the National Gallery of Art&apos;s collection through immersive digital gallery journeys.
            </p>
          </>
        )}
      </div>
      {showingFavoritesShowcase && heroSlides.length > 1 && (
        <div className="absolute right-6 bottom-5 flex gap-1.5">
          {heroSlides.map((slide, index) => (
            <span
              key={`${slide.key}-dot`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === normalizedSlideIndex ? 'w-5 bg-accent' : 'w-1.5 bg-white/40'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {showingFavoritesShowcase && activeSlide ? `Showing favorite artwork ${activeSlide.title}` : ''}
      </div>
    </div>
  )
}
