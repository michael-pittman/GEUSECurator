import { useState, useCallback, useEffect } from 'react'
import type { Artwork, FavoriteEntry } from '../types/artwork'

const STORAGE_KEY = 'nga-favorites'

function loadFavorites(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveFavorites(entries: FavoriteEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // QuotaExceededError — silently fail
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(loadFavorites)

  useEffect(() => {
    saveFavorites(favorites)
  }, [favorites])

  const isFavorited = useCallback(
    (objectid: number) => favorites.some((f) => f.objectid === objectid),
    [favorites]
  )

  const toggleFavorite = useCallback((artwork: Artwork) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.objectid === artwork.objectid)
      if (exists) {
        return prev.filter((f) => f.objectid !== artwork.objectid)
      }
      const thumbUrl =
        artwork.images?.[0]?.iiifthumburl ||
        artwork.iiifthumburl ||
        null
      return [
        ...prev,
        {
          objectid: artwork.objectid,
          title: artwork.title,
          attribution: artwork.attribution,
          iiifthumburl: thumbUrl,
          savedAt: Date.now(),
        },
      ]
    })
  }, [])

  const clearAll = useCallback(() => {
    setFavorites([])
  }, [])

  return { favorites, isFavorited, toggleFavorite, clearAll }
}
