import { useEffect, useState, useCallback } from 'react'
import { HeroSection } from './HeroSection'
import { FeaturedRow } from './FeaturedRow'
import { RecentRow } from './RecentRow'
import { searchArtworks } from '../../api/search'
import type { Artwork } from '../../types/artwork'

interface HomeViewProps {
  onArtworkClick: (artwork: Artwork) => void
}

export function HomeView({ onArtworkClick }: HomeViewProps) {
  const [featured, setFeatured] = useState<Artwork[]>([])
  const [recent, setRecent] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [featuredRes, recentRes] = await Promise.all([
        searchArtworks('masterpiece paintings'),
        searchArtworks('recent art collection'),
      ])
      setFeatured(featuredRes.results ?? [])
      setRecent(recentRes.results ?? [])
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
      <HeroSection artwork={heroArtwork} />
      <FeaturedRow artworks={featured} onArtworkClick={onArtworkClick} />
      <RecentRow artworks={recent} onArtworkClick={onArtworkClick} />
    </div>
  )
}
