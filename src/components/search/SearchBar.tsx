import { useState } from 'react'

interface SearchBarProps {
  onSearch: (query: string) => void
  loading: boolean
}

interface Suggestion {
  label: string
  query: string
}

const SUGGESTIONS: Suggestion[] = [
  { label: 'Impressionism', query: 'Claude Monet water lilies' },
  { label: 'Japanese Prints', query: 'Japanese woodblock prints' },
  { label: 'B&W Photography', query: 'Black and white photography' },
  { label: 'Bronze Sculpture', query: 'Bronze sculpture' },
  { label: 'Still Life', query: 'Still life with fruit' },
  { label: 'Dutch Masters', query: 'Dutch Golden Age paintings' },
]

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="px-5">
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the collection..."
            className="w-full rounded-2xl bg-surface-card border border-glass-border pl-12 pr-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            aria-label="Search artworks"
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" aria-label="Searching" />
          )}
        </div>
      </form>

      {!query && (
        <div className="flex flex-wrap gap-2 px-5 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setQuery(s.label)
                onSearch(s.query)
              }}
              className="px-3 py-1.5 rounded-full bg-glass-warm border border-glass-border text-xs text-text-secondary hover:text-text-primary hover:bg-glass-warm-strong transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
