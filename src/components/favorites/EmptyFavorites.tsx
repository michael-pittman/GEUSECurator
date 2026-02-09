interface EmptyFavoritesProps {
  onExplore: () => void
}

export function EmptyFavorites({ onExplore }: EmptyFavoritesProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <svg className="w-16 h-16 text-text-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      <h3 className="text-lg font-semibold text-text-primary mb-1">No favorites yet</h3>
      <p className="text-sm text-text-secondary mb-6 max-w-xs">
        Tap the heart on any artwork to save it here for later
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="px-6 py-2.5 rounded-full bg-accent text-surface-dark text-sm font-medium hover:bg-accent-light transition-colors"
      >
        Start Exploring
      </button>
    </div>
  )
}
