import { useState, useCallback } from 'react'
import { AppShell } from './components/layout/AppShell'
import { BottomNav } from './components/layout/BottomNav'
import { TabHeader } from './components/layout/TabHeader'
import { HomeView } from './components/home/HomeView'
import { DiscoverView } from './components/discover/DiscoverView'
import { SearchView } from './components/search/SearchView'
import { FavoritesView } from './components/favorites/FavoritesView'
import { SettingsView } from './components/settings/SettingsView'
import { DetailModal } from './components/shared/DetailModal'
import { useFavorites } from './hooks/useFavorites'
import { useSessionId } from './hooks/useSessionId'
import type { TabId } from './types/navigation'
import type { Artwork } from './types/artwork'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)
  const sessionId = useSessionId()
  const { favorites, isFavorited, toggleFavorite, clearAll } = useFavorites()

  const handleArtworkClick = useCallback((artwork: Artwork) => {
    setSelectedArtwork(artwork)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedArtwork(null)
  }, [])

  return (
    <AppShell>
      {/* Skip to content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-surface-dark focus:outline-none focus:ring-2 focus:ring-accent-glow"
      >
        Skip to main content
      </a>

      <TabHeader activeTab={activeTab} />

      <main id="main-content" className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && (
          <HomeView onArtworkClick={handleArtworkClick} />
        )}
        {activeTab === 'discover' && (
          <DiscoverView
            onArtworkClick={handleArtworkClick}
            isFavorited={isFavorited}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {activeTab === 'search' && (
          <SearchView
            onArtworkClick={handleArtworkClick}
            isFavorited={isFavorited}
            onToggleFavorite={toggleFavorite}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            onArtworkClick={handleArtworkClick}
            onRemoveFavorite={toggleFavorite}
            onExplore={() => setActiveTab('discover')}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView onClearFavorites={clearAll} />
        )}
      </main>

      {selectedArtwork && (
        <DetailModal
          artwork={selectedArtwork}
          onClose={handleCloseDetail}
          isFavorited={isFavorited(selectedArtwork.objectid)}
          onToggleFavorite={() => toggleFavorite(selectedArtwork)}
          sessionId={sessionId}
        />
      )}

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        favoriteCount={favorites.length}
      />
    </AppShell>
  )
}

export default App
