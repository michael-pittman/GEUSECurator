# NGA Curator - Full Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-powered web platform for exploring the National Gallery of Art's collection through an interactive gallery and AI curator chat assistant.

**Architecture:** Static React SPA (Vite + Tailwind) with "Liquid Glass" design, communicating via HTTPS to n8n webhook endpoints. n8n orchestrates all backend logic: Postgres (structured data), Qdrant (vector search), and Ollama (embeddings + LLM chat). Data flows from NGA's open CSV data through an ingestion pipeline into both databases.

**Tech Stack:** React 19 + Vite + Tailwind CSS 4 (frontend), n8n v2.6.3 (backend orchestration), PostgreSQL 16 (data), Qdrant v1.13 (vectors), Ollama with mxbai-embed-large + gemma3 (AI), deployed on Geuse.io infrastructure.

---

## Infrastructure State (as of 2026-02-07)

**Already running:**
- n8n at `https://n8n.geuse.io` with 3 active CuratorInTheGeuse workflows + 1 unified PG helper
- PostgreSQL 16 (remote EC2) with NGA schema deployed (5 tables: `artworks`, `artwork_images`, `curator_feedback`, `search_queries`, `vector_metadata`) -- **all empty**
- Qdrant v1.13 with `geuse_artworks` collection (768-dim, cosine) -- **empty**
- Ollama with `mxbai-embed-large` (embeddings, 768d), `gemma3` (chat, 4.3B), `llama3.3` (chat, 70.6B), `llava` (vision, 7B)

**Model mapping (PRD -> Actual):**
| PRD Reference | Actual Available | Use |
|---|---|---|
| `nomic-embed-text` (768d) | `mxbai-embed-large` (768d) | Embeddings |
| `llama2:7b` | `gemma3` (4.3B) or `llama3.3` (70.6B) | Chat |
| (not mentioned) | `llava` (7B) | Vision/image description |

**Existing reusable assets** (from `/Users/nucky/Repos/Curator‑in‑the‑Loop Search/nga-multimodal-search/`):
- Python ingestion script (`scripts/data_ingestion_pipeline.py`) - downloads NGA CSVs, generates AI descriptions, creates embeddings, stores in Postgres + Qdrant
- NGA sample data CSVs (`data/objects.csv`, `data/published_images.csv`)
- n8n workflow JSONs (ingestion, search, curator, helpers)
- Makefile with service URLs and commands
- Postgres init SQL

**Webhook endpoints (existing):**
- `POST /webhook/art-search-chat/chat` - Search
- `POST /webhook/curator-assistant/chat` - Curator Q&A
- `POST /webhook/data-ingestion` - Trigger ingestion

---

## Phase 1: Data Foundation & Infrastructure (Tasks 1-4)

### Task 1: Project Scaffolding & CLAUDE.md

**Files:**
- Create: `CLAUDE.md`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Create CLAUDE.md with project conventions**

```markdown
# NGA Curator

## Project Overview
AI-powered web platform for exploring the National Gallery of Art's open collection. Static React SPA frontend with n8n backend orchestration.

## Architecture
- **Frontend:** React 19 + Vite + Tailwind CSS 4, static site deployed to Geuse.io S3
- **Backend:** n8n workflows at https://n8n.geuse.io (webhook API)
- **Database:** PostgreSQL 16 (structured data), Qdrant v1.13 (vector search)
- **AI:** Ollama with mxbai-embed-large (embeddings) + gemma3 (chat)

## Service URLs
- n8n: https://n8n.geuse.io
- Ollama: http://ollama.geuse.io (internal: ollama:11434)
- Qdrant: http://qdrant.geuse.io (internal: qdrant:6333)
- PostgreSQL: postgres.geuse.io:5432

## API Endpoints
- POST /webhook/art-search-chat/chat - Search artworks
- POST /webhook/curator-assistant/chat - AI curator Q&A
- POST /webhook/data-ingestion - Trigger data ingestion

## Frontend Commands
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run preview` - Preview production build

## Conventions
- Use TypeScript strict mode
- Components in `src/components/` with PascalCase filenames
- Hooks in `src/hooks/` with `use` prefix
- API calls in `src/api/`
- Types in `src/types/`
- Tailwind for all styling, no CSS modules
- Use CSS `backdrop-filter: blur()` for Liquid Glass effects
```

**Step 2: Create .env.example**

```bash
# API Configuration
VITE_N8N_BASE_URL=https://n8n.geuse.io
VITE_SEARCH_ENDPOINT=/webhook/art-search-chat/chat
VITE_CURATOR_ENDPOINT=/webhook/curator-assistant/chat
VITE_DETAIL_ENDPOINT=/webhook/detail
VITE_FLAG_ENDPOINT=/webhook/flag
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
.env.local
.DS_Store
*.log
```

**Step 4: Commit**

```bash
git add CLAUDE.md .env.example .gitignore
git commit -m "chore: project scaffolding with conventions and env config"
```

---

### Task 2: Run Data Ingestion (Populate Postgres + Qdrant)

**Context:** The Python ingestion script already exists at `/Users/nucky/Repos/Curator‑in‑the‑Loop Search/nga-multimodal-search/scripts/data_ingestion_pipeline.py`. We need to copy it into our project, configure it for the correct models, and run it to populate the empty databases.

**Files:**
- Create: `scripts/data_ingestion_pipeline.py` (copy from sibling project)
- Create: `scripts/requirements.txt` (copy from sibling project)
- Modify: Script to use correct model names (`mxbai-embed-large`)

**Step 1: Copy and review the ingestion script**

Copy from `/Users/nucky/Repos/Curator‑in‑the‑Loop Search/nga-multimodal-search/scripts/data_ingestion_pipeline.py` into `scripts/data_ingestion_pipeline.py`.

Review the script for:
- Model references (change `nomic-embed-text` -> `mxbai-embed-large` if needed)
- Database connection parameters
- Qdrant collection name (`geuse_artworks`)
- Ollama endpoint

**Step 2: Copy requirements.txt**

Copy from `/Users/nucky/Repos/Curator‑in‑the‑Loop Search/nga-multimodal-search/scripts/requirements.txt`.

**Step 3: Create a .env file (local, not committed) with actual credentials**

```bash
# PostgreSQL
POSTGRES_HOST=postgres.geuse.io
POSTGRES_PORT=5432
POSTGRES_DB=n8n
POSTGRES_USER=root
POSTGRES_PASSWORD=<actual password from n8n credentials>

# Qdrant
QDRANT_HOST=qdrant.geuse.io
QDRANT_PORT=6333
QDRANT_COLLECTION=geuse_artworks

# Ollama
OLLAMA_HOST=http://ollama.geuse.io

# Models
EMBEDDING_MODEL=mxbai-embed-large
VISION_MODEL=llava
CHAT_MODEL=gemma3
```

**Step 4: Install Python dependencies and run ingestion (small batch first)**

```bash
cd /Users/nucky/Repos/NGA
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
python scripts/data_ingestion_pipeline.py --limit 10
```

Verify:
- Check Postgres: `SELECT count(*) FROM artworks;` should return 10
- Check Qdrant: collection `geuse_artworks` should have 10 points

**Step 5: Run larger ingestion batch**

```bash
python scripts/data_ingestion_pipeline.py --limit 500
```

Verify counts match in both Postgres and Qdrant.

**Step 6: Commit scripts**

```bash
git add scripts/
git commit -m "feat: add data ingestion pipeline for NGA open data"
```

---

### Task 3: Verify & Configure n8n Workflows

**Context:** n8n already has CuratorInTheGeuse workflows deployed. We need to verify they work with the ingested data and understand the exact request/response format for the frontend.

**Step 1: Activate the Data Ingestion workflow if not already active**

Use n8n MCP tools:
- Check workflow `5nvLxjFeJ1LzdBpr` (AI Data Ingestion) status
- Activate if needed

**Step 2: Test the Search webhook**

```bash
curl -X POST https://n8n.geuse.io/webhook/art-search-chat/chat \
  -H "Content-Type: application/json" \
  -d '{"chatInput": "impressionist paintings"}'
```

Document the exact response format for frontend integration.

**Step 3: Test the Curator webhook**

```bash
curl -X POST https://n8n.geuse.io/webhook/curator-assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"chatInput": "What impressionist paintings do you have?", "sessionId": "test-001"}'
```

Document the exact response format.

**Step 4: Document API contract in a reference file**

Create `docs/api-contract.md` with the actual request/response shapes observed.

**Step 5: Commit**

```bash
git add docs/api-contract.md
git commit -m "docs: document n8n API contract from live testing"
```

---

### Task 4: Verify Qdrant Search Quality

**Step 1: Run a few semantic searches directly against Qdrant to verify embedding quality**

```bash
# Generate a test embedding
curl -s http://ollama.geuse.io/api/embeddings \
  -d '{"model": "mxbai-embed-large", "prompt": "impressionist landscape painting"}' \
  | jq '.embedding[:5]'  # verify we get 768-dim vector

# Search Qdrant
curl -s http://qdrant.geuse.io:6333/collections/geuse_artworks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 5, "with_payload": true}' | jq '.result.points[:2]'
```

**Step 2: Document what payload fields are available in Qdrant points**

This informs what data we can display without a separate Postgres call.

---

## Phase 2: Frontend MVP - Gallery & Search (Tasks 5-10)

### Task 5: Frontend Project Setup

**Files:**
- Create: `package.json` (via Vite scaffold)
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

**Step 1: Scaffold React + Vite + TypeScript project**

```bash
cd /Users/nucky/Repos/NGA
npm create vite@latest . -- --template react-ts
npm install
```

**Step 2: Install Tailwind CSS 4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Configure `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Update `src/index.css`:
```css
@import "tailwindcss";
```

**Step 3: Set up base Liquid Glass CSS variables in index.css**

```css
@import "tailwindcss";

@theme {
  --color-glass-white: rgba(255, 255, 255, 0.12);
  --color-glass-white-strong: rgba(255, 255, 255, 0.25);
  --color-glass-border: rgba(255, 255, 255, 0.18);
  --color-glass-shadow: rgba(0, 0, 0, 0.12);
  --color-surface-dark: #0a0a0a;
  --color-surface-card: #141414;
  --color-text-primary: #f5f5f5;
  --color-text-secondary: #a0a0a0;
  --color-accent: #8b5cf6;
  --color-accent-glow: rgba(139, 92, 246, 0.3);
}

body {
  background-color: var(--color-surface-dark);
  color: var(--color-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
}
```

**Step 4: Create minimal App.tsx shell**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-surface-dark">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-glass-white border-b border-glass-border px-6 py-4">
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">NGA Curator</h1>
      </header>
      <main className="px-6 py-8">
        <p className="text-text-secondary">Gallery coming soon...</p>
      </main>
    </div>
  )
}

export default App
```

**Step 5: Verify dev server runs**

```bash
npm run dev
```

Open in browser, verify the dark background + glass header renders.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold frontend with React, Vite, Tailwind, Liquid Glass theme"
```

---

### Task 6: TypeScript Types & API Client

**Files:**
- Create: `src/types/artwork.ts`
- Create: `src/api/client.ts`
- Create: `src/api/search.ts`
- Create: `src/api/curator.ts`

**Step 1: Define artwork types based on Postgres schema + Qdrant payload**

```typescript
// src/types/artwork.ts

export interface Artwork {
  objectid: number
  title: string
  attribution: string
  displaydate: string
  medium: string
  classification: string
  beginyear: number | null
  endyear: number | null
  creditline: string
  images: ArtworkImage[]
  ai_description?: string
  score?: number
}

export interface ArtworkImage {
  uuid: string
  iiifurl: string
  iiifthumburl: string
  viewtype: string
  sequence: number
  width: number
  height: number
  assistivetext: string
}

export interface SearchRequest {
  chatInput: string
}

export interface SearchResponse {
  output: string
  results?: Artwork[]
}

export interface CuratorRequest {
  chatInput: string
  sessionId: string
  contextObjectId?: number
}

export interface CuratorResponse {
  output: string
  mentions?: { objectid: number; title: string }[]
  related?: number[]
}
```

> **Note:** The exact response shapes from n8n webhooks need to be confirmed in Task 3. Update these types to match the actual API responses.

**Step 2: Create base API client**

```typescript
// src/api/client.ts

const BASE_URL = import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.geuse.io'

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}
```

**Step 3: Create search API function**

```typescript
// src/api/search.ts

import { apiPost } from './client'
import type { SearchRequest, SearchResponse } from '../types/artwork'

const SEARCH_ENDPOINT = import.meta.env.VITE_SEARCH_ENDPOINT || '/webhook/art-search-chat/chat'

export async function searchArtworks(query: string): Promise<SearchResponse> {
  return apiPost<SearchResponse>(SEARCH_ENDPOINT, { chatInput: query } satisfies SearchRequest)
}
```

**Step 4: Create curator API function**

```typescript
// src/api/curator.ts

import { apiPost } from './client'
import type { CuratorRequest, CuratorResponse } from '../types/artwork'

const CURATOR_ENDPOINT = import.meta.env.VITE_CURATOR_ENDPOINT || '/webhook/curator-assistant/chat'

export async function askCurator(
  query: string,
  sessionId: string,
  contextObjectId?: number
): Promise<CuratorResponse> {
  return apiPost<CuratorResponse>(CURATOR_ENDPOINT, {
    chatInput: query,
    sessionId,
    contextObjectId,
  } satisfies CuratorRequest)
}
```

**Step 5: Commit**

```bash
git add src/types/ src/api/
git commit -m "feat: add TypeScript types and API client for n8n webhooks"
```

---

### Task 7: ArtworkCard Component

**Files:**
- Create: `src/components/ArtworkCard.tsx`

**Step 1: Build the ArtworkCard with Liquid Glass hover effects**

Use the `frontend-design` skill for this component. The card should:
- Display IIIF thumbnail image (lazy loaded)
- Show title + artist overlay on hover (glassmorphism)
- Scale up slightly on hover (3-5%)
- Handle missing images gracefully
- Be responsive (fill grid cell)

```typescript
// src/components/ArtworkCard.tsx

import type { Artwork } from '../types/artwork'

interface ArtworkCardProps {
  artwork: Artwork
  onClick: (artwork: Artwork) => void
}

export function ArtworkCard({ artwork, onClick }: ArtworkCardProps) {
  const thumbUrl = artwork.images?.[0]?.iiifthumburl
  const altText = artwork.images?.[0]?.assistivetext || artwork.title

  return (
    <button
      onClick={() => onClick(artwork)}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-card cursor-pointer transition-all duration-300 ease-out hover:scale-[1.03] hover:shadow-2xl hover:shadow-accent-glow/20 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={altText}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface-card">
          <span className="text-text-secondary text-sm">No image</span>
        </div>
      )}

      {/* Glass overlay on hover */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-300 ease-out group-hover:translate-y-0">
        <div className="backdrop-blur-xl bg-glass-white-strong border-t border-glass-border p-4">
          <h3 className="text-sm font-medium text-text-primary line-clamp-2 leading-tight">
            {artwork.title}
          </h3>
          <p className="mt-1 text-xs text-text-secondary line-clamp-1">
            {artwork.attribution}
          </p>
          {artwork.displaydate && (
            <p className="mt-0.5 text-xs text-text-secondary/70">
              {artwork.displaydate}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ArtworkCard.tsx
git commit -m "feat: add ArtworkCard component with Liquid Glass hover overlay"
```

---

### Task 8: ArtworkGrid Component + Loading Skeleton

**Files:**
- Create: `src/components/ArtworkGrid.tsx`
- Create: `src/components/SkeletonCard.tsx`

**Step 1: Build skeleton loading card**

```typescript
// src/components/SkeletonCard.tsx

export function SkeletonCard() {
  return (
    <div className="aspect-[3/4] animate-pulse rounded-2xl bg-surface-card" />
  )
}
```

**Step 2: Build responsive grid**

```typescript
// src/components/ArtworkGrid.tsx

import type { Artwork } from '../types/artwork'
import { ArtworkCard } from './ArtworkCard'
import { SkeletonCard } from './SkeletonCard'

interface ArtworkGridProps {
  artworks: Artwork[]
  loading: boolean
  onArtworkClick: (artwork: Artwork) => void
}

export function ArtworkGrid({ artworks, loading, onArtworkClick }: ArtworkGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (artworks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg text-text-secondary">No artworks found</p>
        <p className="mt-2 text-sm text-text-secondary/60">Try a different search or adjust your filters</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {artworks.map((artwork) => (
        <ArtworkCard
          key={artwork.objectid}
          artwork={artwork}
          onClick={onArtworkClick}
        />
      ))}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/ArtworkGrid.tsx src/components/SkeletonCard.tsx
git commit -m "feat: add responsive ArtworkGrid with skeleton loading state"
```

---

### Task 9: SearchBar Component

**Files:**
- Create: `src/components/SearchBar.tsx`

**Step 1: Build search bar with glass styling**

```typescript
// src/components/SearchBar.tsx

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
      <div className="relative flex items-center backdrop-blur-xl bg-glass-white rounded-2xl border border-glass-border shadow-lg shadow-glass-shadow transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-accent-glow/10">
        {/* Search icon */}
        <svg
          className="ml-4 h-5 w-5 shrink-0 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artworks, artists, styles..."
          className="w-full bg-transparent py-4 px-3 text-text-primary placeholder:text-text-secondary/50 outline-none"
        />

        {loading && (
          <div className="mr-4 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
      </div>
    </form>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/SearchBar.tsx
git commit -m "feat: add SearchBar component with glass styling"
```

---

### Task 10: Wire Up Gallery Page (App.tsx)

**Files:**
- Modify: `src/App.tsx`
- Create: `src/hooks/useSearch.ts`
- Create: `src/hooks/useSessionId.ts`

**Step 1: Create search hook**

```typescript
// src/hooks/useSearch.ts

import { useState, useCallback } from 'react'
import { searchArtworks } from '../api/search'
import type { Artwork, SearchResponse } from '../types/artwork'

export function useSearch() {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const response: SearchResponse = await searchArtworks(query)
      // Adapt response shape to our Artwork type
      // This will need adjustment once we confirm the actual n8n response format
      setArtworks(response.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setArtworks([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { artworks, loading, error, search }
}
```

**Step 2: Create session ID hook**

```typescript
// src/hooks/useSessionId.ts

import { useMemo } from 'react'

export function useSessionId(): string {
  return useMemo(() => {
    const stored = localStorage.getItem('nga-session-id')
    if (stored) return stored
    const id = crypto.randomUUID()
    localStorage.setItem('nga-session-id', id)
    return id
  }, [])
}
```

**Step 3: Wire up App.tsx with SearchBar + ArtworkGrid**

```typescript
// src/App.tsx

import { useState } from 'react'
import { SearchBar } from './components/SearchBar'
import { ArtworkGrid } from './components/ArtworkGrid'
import { useSearch } from './hooks/useSearch'
import type { Artwork } from './types/artwork'

function App() {
  const { artworks, loading, error, search } = useSearch()
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)

  return (
    <div className="min-h-screen bg-surface-dark">
      {/* Glass header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-glass-white/80 border-b border-glass-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              NGA Curator
            </h1>
          </div>
          <div className="mt-4 pb-2">
            <SearchBar onSearch={search} loading={loading} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <ArtworkGrid
          artworks={artworks}
          loading={loading}
          onArtworkClick={setSelectedArtwork}
        />
      </main>

      {/* Detail modal placeholder - Task 11 */}
      {selectedArtwork && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedArtwork(null)}
        >
          <div
            className="mx-4 max-w-2xl rounded-3xl backdrop-blur-2xl bg-glass-white-strong border border-glass-border p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-text-primary">{selectedArtwork.title}</h2>
            <p className="mt-1 text-sm text-text-secondary">{selectedArtwork.attribution}</p>
            <p className="mt-4 text-xs text-text-secondary/60">Full detail view coming in Task 11...</p>
            <button
              onClick={() => setSelectedArtwork(null)}
              className="mt-4 rounded-xl bg-glass-white px-4 py-2 text-sm text-text-primary hover:bg-glass-white-strong transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
```

**Step 4: Test the full flow**

```bash
npm run dev
```

- Open browser, type a search query, verify results appear in the grid
- Click an artwork card, verify the placeholder detail modal opens
- Test on mobile viewport (responsive grid should collapse to 1-2 columns)

**Step 5: Commit**

```bash
git add src/App.tsx src/hooks/ src/components/
git commit -m "feat: wire up gallery page with search and artwork grid"
```

---

## Phase 3: Detail View & Polish (Tasks 11-13)

### Task 11: Artwork Detail Modal

**Files:**
- Create: `src/components/DetailModal.tsx`
- Modify: `src/App.tsx` (replace placeholder)

**Step 1: Build the full detail modal**

The modal should:
- Show large artwork image (primary IIIF image)
- Display full metadata (title, artist, date, medium, dimensions, credit line)
- Show AI-generated description if available
- Include "Ask about this artwork" button (placeholder for Phase 4)
- Use Liquid Glass styling with backdrop blur
- Animate in/out
- Close on backdrop click or Escape key

```typescript
// src/components/DetailModal.tsx

import { useEffect } from 'react'
import type { Artwork } from '../types/artwork'

interface DetailModalProps {
  artwork: Artwork
  onClose: () => void
  onAskCurator?: (artwork: Artwork) => void
}

export function DetailModal({ artwork, onClose, onAskCurator }: DetailModalProps) {
  const primaryImage = artwork.images?.find((img) => img.viewtype === 'primary') ?? artwork.images?.[0]

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl backdrop-blur-2xl bg-surface-card/95 border border-glass-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full backdrop-blur-xl bg-glass-white p-2 text-text-secondary hover:text-text-primary hover:bg-glass-white-strong transition-all"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        {primaryImage && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-3xl bg-black">
            <img
              src={primaryImage.iiifurl || primaryImage.iiifthumburl}
              alt={primaryImage.assistivetext || artwork.title}
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {/* Info */}
        <div className="p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-text-primary leading-tight">
            {artwork.title}
          </h2>
          <p className="mt-2 text-lg text-text-secondary">{artwork.attribution}</p>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {artwork.displaydate && (
              <div>
                <span className="text-text-secondary/60">Date</span>
                <p className="mt-0.5 text-text-primary">{artwork.displaydate}</p>
              </div>
            )}
            {artwork.medium && (
              <div>
                <span className="text-text-secondary/60">Medium</span>
                <p className="mt-0.5 text-text-primary">{artwork.medium}</p>
              </div>
            )}
            {artwork.classification && (
              <div>
                <span className="text-text-secondary/60">Classification</span>
                <p className="mt-0.5 text-text-primary">{artwork.classification}</p>
              </div>
            )}
            {artwork.creditline && (
              <div className="col-span-2">
                <span className="text-text-secondary/60">Credit</span>
                <p className="mt-0.5 text-text-primary text-xs">{artwork.creditline}</p>
              </div>
            )}
          </div>

          {artwork.ai_description && (
            <div className="mt-6">
              <span className="text-text-secondary/60 text-sm">About this work</span>
              <p className="mt-1 text-sm text-text-secondary leading-relaxed">{artwork.ai_description}</p>
            </div>
          )}

          {onAskCurator && (
            <button
              onClick={() => onAskCurator(artwork)}
              className="mt-6 w-full rounded-2xl bg-accent/20 border border-accent/30 px-4 py-3 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
            >
              Ask the Curator about this artwork
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Replace placeholder in App.tsx**

Replace the placeholder detail modal section in `App.tsx` with `<DetailModal>`.

**Step 3: Commit**

```bash
git add src/components/DetailModal.tsx src/App.tsx
git commit -m "feat: add artwork detail modal with full metadata display"
```

---

### Task 12: Initial Data Load (Browse Without Search)

**Context:** When users first visit, they should see artworks immediately without needing to search. We need either a "load initial artworks" API call or a default search.

**Files:**
- Modify: `src/hooks/useSearch.ts` (add initial load)
- Possibly modify: `src/App.tsx`

**Step 1: Add initial load to useSearch hook**

Add a `loadInitial` function that fetches a default set (e.g., search for "*" or a curated query like "paintings").

```typescript
// Add to useSearch.ts
const loadInitial = useCallback(async () => {
  setLoading(true)
  try {
    const response = await searchArtworks('paintings')
    setArtworks(response.results ?? [])
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load artworks')
  } finally {
    setLoading(false)
  }
}, [])
```

**Step 2: Call loadInitial on mount in App.tsx**

```typescript
useEffect(() => { loadInitial() }, [loadInitial])
```

**Step 3: Test - page should show artworks immediately on load**

**Step 4: Commit**

```bash
git add src/hooks/useSearch.ts src/App.tsx
git commit -m "feat: load initial artworks on page mount"
```

---

### Task 13: Responsive Polish & Accessibility

**Files:**
- Modify: Various component files

**Step 1: Add ARIA labels and keyboard navigation**

- ArtworkCard: already uses `<button>`, verify `aria-label`
- DetailModal: add `role="dialog"` and `aria-modal="true"`
- SearchBar: add `aria-label` to input
- ArtworkGrid: add `role="list"` and `role="listitem"` if needed

**Step 2: Test at all breakpoints**

- 320px (small mobile)
- 375px (iPhone)
- 768px (tablet)
- 1024px (desktop)
- 1440px (large desktop)

**Step 3: Verify image lazy loading works (check Network tab)**

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: accessibility improvements and responsive polish"
```

---

## Phase 4: AI Curator Chat (Tasks 14-17)

### Task 14: CuratorPanel Component (Chat UI)

**Files:**
- Create: `src/components/CuratorPanel.tsx`
- Create: `src/components/CuratorMessage.tsx`
- Create: `src/hooks/useCurator.ts`

**Step 1: Build the chat hook**

```typescript
// src/hooks/useCurator.ts

import { useState, useCallback } from 'react'
import { askCurator } from '../api/curator'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  mentions?: { objectid: number; title: string }[]
}

export function useCurator(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const send = useCallback(
    async (query: string, contextObjectId?: number) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)

      try {
        const response = await askCurator(query, sessionId, contextObjectId)
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.output,
          timestamp: new Date(),
          mentions: response.mentions,
        }
        setMessages((prev) => [...prev, aiMsg])
      } catch {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, the curator is unavailable right now. Please try again.',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errMsg])
      } finally {
        setLoading(false)
      }
    },
    [sessionId]
  )

  return { messages, loading, send }
}
```

**Step 2: Build message component**

```typescript
// src/components/CuratorMessage.tsx

import type { ChatMessage } from '../hooks/useCurator'

interface CuratorMessageProps {
  message: ChatMessage
}

export function CuratorMessage({ message }: CuratorMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-accent/20 text-text-primary'
            : 'backdrop-blur-xl bg-glass-white border border-glass-border text-text-primary'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <time className="mt-1 block text-[10px] text-text-secondary/50">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>
    </div>
  )
}
```

**Step 3: Build the panel**

```typescript
// src/components/CuratorPanel.tsx

import { useState, useRef, useEffect } from 'react'
import { useCurator } from '../hooks/useCurator'
import { CuratorMessage } from './CuratorMessage'

interface CuratorPanelProps {
  sessionId: string
  contextObjectId?: number
  onClose: () => void
}

export function CuratorPanel({ sessionId, contextObjectId, onClose }: CuratorPanelProps) {
  const { messages, loading, send } = useCurator(sessionId)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    send(input.trim(), contextObjectId)
    setInput('')
  }

  return (
    <div className="fixed bottom-0 right-0 z-40 flex h-[70vh] w-full flex-col sm:bottom-4 sm:right-4 sm:h-[600px] sm:w-[420px] sm:rounded-3xl backdrop-blur-2xl bg-surface-card/95 border border-glass-border shadow-2xl sm:shadow-accent-glow/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-glass-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">NGA Curator</h2>
          <p className="text-xs text-text-secondary">Ask me about the collection</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-glass-white p-1.5 text-text-secondary hover:text-text-primary hover:bg-glass-white-strong transition-all"
          aria-label="Close chat"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-text-secondary">Ask me about artworks, artists, or styles.</p>
              <div className="mt-4 space-y-2">
                {['What impressionist paintings do you have?', 'Tell me about Monet', 'Show me sculptures'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => send(suggestion, contextObjectId)}
                      className="block w-full rounded-xl bg-glass-white border border-glass-border px-3 py-2 text-left text-xs text-text-secondary hover:text-text-primary hover:bg-glass-white-strong transition-colors"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <CuratorMessage key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl backdrop-blur-xl bg-glass-white border border-glass-border px-4 py-3">
              <div className="flex space-x-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/40" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/40" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary/40" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-glass-border p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the curator..."
            className="flex-1 rounded-xl bg-glass-white border border-glass-border px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent/40 transition-colors"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-xl bg-accent/20 border border-accent/30 p-3 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/CuratorPanel.tsx src/components/CuratorMessage.tsx src/hooks/useCurator.ts
git commit -m "feat: add AI Curator chat panel with conversation UI"
```

---

### Task 15: Integrate Chat Panel into App

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add chat toggle button and panel to App**

Add state for `chatOpen` and `chatContextObjectId`. Add a floating "Ask Curator" button. When clicking "Ask about this artwork" in the detail modal, open chat with that artwork's ID as context.

```typescript
// Add to App.tsx state:
const [chatOpen, setChatOpen] = useState(false)
const [chatContextId, setChatContextId] = useState<number | undefined>()
const sessionId = useSessionId()

// Add handler:
const handleAskCurator = (artwork: Artwork) => {
  setChatContextId(artwork.objectid)
  setChatOpen(true)
  setSelectedArtwork(null) // close detail modal
}
```

Add floating button in JSX (before closing `</div>`):
```tsx
{/* Curator chat toggle */}
{!chatOpen && (
  <button
    onClick={() => { setChatContextId(undefined); setChatOpen(true) }}
    className="fixed bottom-6 right-6 z-30 rounded-full bg-accent/90 p-4 text-white shadow-lg shadow-accent/30 hover:bg-accent transition-all hover:scale-105"
    aria-label="Open AI Curator chat"
  >
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  </button>
)}

{/* Curator Panel */}
{chatOpen && (
  <CuratorPanel
    sessionId={sessionId}
    contextObjectId={chatContextId}
    onClose={() => setChatOpen(false)}
  />
)}
```

**Step 2: Pass `onAskCurator` to DetailModal**

```tsx
<DetailModal
  artwork={selectedArtwork}
  onClose={() => setSelectedArtwork(null)}
  onAskCurator={handleAskCurator}
/>
```

**Step 3: Test the full flow**

- Click floating chat button -> panel opens
- Ask a question -> get AI response
- Open artwork detail -> click "Ask the Curator" -> chat opens with context
- Close chat panel -> floating button reappears

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate curator chat panel with floating toggle and context linking"
```

---

### Task 16: API Response Adaptation Layer

**Context:** The actual n8n webhook responses may not match our TypeScript types exactly. After testing in Task 3, we need to add adaptation logic.

**Files:**
- Modify: `src/api/search.ts`
- Modify: `src/api/curator.ts`
- Possibly modify: `src/types/artwork.ts`

**Step 1: Test actual API responses and document shape**

Run the curl commands from Task 3 and capture the exact JSON structure.

**Step 2: Write adapter functions to transform n8n responses to our Artwork type**

This step depends on the actual response format. Common patterns:
- n8n chat nodes return `{ "output": "text" }` format
- Search results may be embedded in the output text or as separate structured data
- May need to parse the AI output text to extract artwork references

**Step 3: Update types and API functions accordingly**

**Step 4: Commit**

```bash
git add src/api/ src/types/
git commit -m "fix: adapt API client to actual n8n webhook response format"
```

---

### Task 17: Production Build & Deployment Prep

**Files:**
- Modify: `vite.config.ts` (if needed for S3/CDN)
- Create: `.env.production`

**Step 1: Create production env**

```bash
# .env.production
VITE_N8N_BASE_URL=https://n8n.geuse.io
VITE_SEARCH_ENDPOINT=/webhook/art-search-chat/chat
VITE_CURATOR_ENDPOINT=/webhook/curator-assistant/chat
```

**Step 2: Build and verify**

```bash
npm run build
npm run preview
```

Test the preview build works correctly with all features.

**Step 3: Check bundle size**

```bash
npx vite-bundle-visualizer
```

Ensure the bundle is reasonable for a static site (<500KB gzipped).

**Step 4: Commit**

```bash
git add .env.production vite.config.ts
git commit -m "chore: production build configuration"
```

---

## Phase 5: Content Flagging (Tasks 18-19) -- v1.1

### Task 18: Flag Form Modal

**Files:**
- Create: `src/components/FlagForm.tsx`
- Create: `src/api/flag.ts`

**Step 1: Create flagging API**

```typescript
// src/api/flag.ts

import { apiPost } from './client'

interface FlagRequest {
  object_id?: number
  category: string
  description: string
  reporter_session_id: string
}

const FLAG_ENDPOINT = import.meta.env.VITE_FLAG_ENDPOINT || '/webhook/flag'

export async function submitFlag(data: FlagRequest): Promise<{ status: string }> {
  return apiPost(FLAG_ENDPOINT, data)
}
```

**Step 2: Build FlagForm component**

A modal with:
- Category dropdown (sensitive_imagery, cultural_concern, inaccurate_description, copyright_issue, other)
- Description textarea (max 2000 chars)
- Submit button
- Glass styling

**Step 3: Add flag buttons to DetailModal and CuratorMessage**

Small flag icon on each artwork detail and AI response.

**Step 4: Commit**

```bash
git add src/components/FlagForm.tsx src/api/flag.ts
git commit -m "feat: add content flagging form and API integration"
```

---

### Task 19: Create n8n Flagging Workflow

**Context:** This requires creating a new n8n workflow for the `/webhook/flag` endpoint. Use the n8n MCP tools to create and configure it.

**Step 1: Design the workflow**

- Webhook trigger at `/webhook/flag`
- Validate input (category required, description required, max length)
- Rate limit check (count flags per session in last hour)
- Insert into `content_flags` table in Postgres
- Return `{ "status": "ok" }`

> **Note:** The `content_flags` table may need to be created first if it doesn't exist in the remote schema. Check and create via SQL if needed.

**Step 2: Build using n8n MCP tools**

Use `@n8n-workflow-patterns` skill for webhook processing pattern.

**Step 3: Test the webhook**

```bash
curl -X POST https://n8n.geuse.io/webhook/flag \
  -H "Content-Type: application/json" \
  -d '{"object_id": 1, "category": "inaccurate_description", "description": "Test flag", "reporter_session_id": "test-001"}'
```

**Step 4: Commit workflow JSON**

```bash
git add n8n/workflows/flagging.json
git commit -m "feat: add content flagging n8n workflow"
```

---

## Dependency Graph

```
Task 1 (Scaffolding) ─────────────────────────────┐
                                                    │
Task 2 (Data Ingestion) ──► Task 3 (Verify n8n) ──► Task 4 (Verify Qdrant)
                                                    │
Task 5 (Frontend Setup) ──► Task 6 (Types/API) ───► Task 7 (ArtworkCard) ──► Task 8 (Grid)
                                                    │
                                                    ├──► Task 9 (SearchBar)
                                                    │
Tasks 7-9 ──► Task 10 (Wire App.tsx) ──► Task 11 (Detail Modal) ──► Task 12 (Initial Load)
                                                    │
Task 12 ──► Task 13 (Polish) ──► Task 16 (API Adapt) ──► Task 17 (Deploy Prep)
                                                    │
Task 10 ──► Task 14 (Chat UI) ──► Task 15 (Integrate Chat)
                                                    │
Task 15 + 17 ──► Task 18 (Flag Form) ──► Task 19 (Flag Workflow)
```

**Parallelizable groups:**
- Tasks 1 + 2 can run in parallel (scaffolding + data ingestion)
- Tasks 5-6 can start while Tasks 2-4 run (frontend doesn't need live data initially)
- Tasks 7, 8, 9 can be built in parallel (independent components)
- Tasks 14 can start as soon as Task 10 is done (independent of Task 11-13)

---

## Success Criteria (Full MVP)

| Metric | Target |
|---|---|
| Artworks ingested & searchable | 500+ objects |
| Gallery load time | < 2s initial load |
| Search result latency | < 500ms p95 |
| AI curator response time | < 3s average |
| Responsive breakpoints | 320px, 768px, 1024px, 1440px |
| Accessibility | WCAG AA basic compliance |
| Bundle size | < 500KB gzipped |
