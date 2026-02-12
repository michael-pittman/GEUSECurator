import { useEffect, useState, useCallback, useMemo } from 'react'
import { HeroSection } from './HeroSection'
import { FeaturedRow } from './FeaturedRow'
import { RecentRow } from './RecentRow'
import { searchArtworks, searchNewestArtworks } from '../../api/search'
import { shuffleWithSeed, getDateSeed } from '../../utils/shuffle'
import type { Artwork, FavoriteEntry } from '../../types/artwork'

interface HomeViewProps {
  onArtworkClick: (artwork: Artwork) => void
  onSeeAll: () => void
  favorites: FavoriteEntry[]
}

const FEATURED_POOL_SIZE = 15
const FEATURED_DISPLAY_COUNT = 5

export function HomeView({ onArtworkClick, onSeeAll, favorites }: HomeViewProps) {
  const [featured, setFeatured] = useState<Artwork[]>([])
  const [recent, setRecent] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Featured: semantic search for quality highlights; hero = best match
      const featuredRes = await searchArtworks('masterpiece paintings')
      const featuredResults = featuredRes.results ?? []
      setFeatured(featuredResults)

      // Recent: try newest-by-ingestion first, fallback to semantic if endpoint not deployed
      let recentResults: Artwork[] = []
      try {
        const newestRes = await searchNewestArtworks()
        recentResults = newestRes.results ?? []
      } catch {
        recentResults = (await searchArtworks('recent art collection')).results ?? []
      }
      setRecent(recentResults)
    } catch {
      // Silently fail — show empty sections
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const heroArtwork = featured[0] ?? null

  // Daily-varying highlights: shuffle top pool by date seed, take first 5
  const displayedHighlights = useMemo(() => {
    const pool = featured.slice(0, FEATURED_POOL_SIZE)
    if (pool.length <= FEATURED_DISPLAY_COUNT) return pool
    return shuffleWithSeed(pool, getDateSeed()).slice(0, FEATURED_DISPLAY_COUNT)
  }, [featured])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="mx-5 rounded-3xl bg-surface-card aspect-[3/4] sm:aspect-[16/9] max-h-[500px]" />
        <div className="mx-5 h-6 bg-surface-card rounded-lg w-48" />
        <div className="flex gap-3 px-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-shrink-0 w-48 aspect-[4/3] rounded-2xl bg-surface-card" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6 space-y-2">
      <HeroSection artwork={heroArtwork} favorites={favorites} />
      <FeaturedRow artworks={displayedHighlights} onArtworkClick={onArtworkClick} />
      <RecentRow artworks={recent} onArtworkClick={onArtworkClick} onSeeAll={onSeeAll} />
    </div>
  )
}
