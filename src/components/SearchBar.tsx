import { useState, useCallback } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        onSearch(query.trim())
      }
    },
    [query, onSearch]
  )

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center backdrop-blur-xl bg-glass-white rounded-xl sm:rounded-2xl border border-glass-border shadow-lg shadow-glass-shadow transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-accent-glow/10">
        {/* Search icon */}
        <svg
          className="ml-3 sm:ml-4 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artworks, artists, styles..."
          className="w-full bg-transparent py-3 px-2 sm:py-4 sm:px-3 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 outline-none"
          aria-label="Search artworks"
          autoComplete="off"
        />

        {loading && (
          <div className="mr-3 sm:mr-4 h-4 w-4 sm:h-5 sm:w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Loading" />
        )}
      </div>
    </form>
  )
}
