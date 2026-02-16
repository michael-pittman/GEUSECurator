# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NGA Curator is an AI-powered web platform for exploring the National Gallery of Art's open collection. Static React SPA frontend hosted on AWS S3, with n8n backend workflows on a GPU instance handling search, AI chat, and data ingestion.

## Architecture

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4 — static SPA at https://www.geuse.io/curator/
- **Backend:** n8n workflows at https://ai.geuse.io (GPU instance, g4dn.xlarge with Tesla T4)
- **Database:** PostgreSQL 15 (structured data), Qdrant v1.16 (vector search)
- **AI Models (Ollama):** `nomic-embed-text:latest` (embeddings, 768-d), `qwen2.5:1.5b-instruct` (chat), `llava:latest` (vision)
- **Internal service hostnames (Docker):** `ollama:11434`, `qdrant:6333`, `postgres:5432`

## API Endpoints

Base URL: `https://ai.geuse.io`

- `POST /webhook/AvbnMRIDp33SQl10/webhook/art-search-chat/chat` — Search artworks. Body: `{ "chatInput": string, "sessionId": string }`
- `POST /webhook/LNfYCLoZluQYsHow/webhook/home-newest` — Newest artworks by `last_ingested_at` (for home "Check out more"). Body: `{}`, Response: `{ "results": Artwork[] }`. Frontend falls back to semantic search if not deployed.
- `POST /webhook/viTJbYAQaPs80m4O/webhook/curator-assistant/chat` — AI curator Q&A. Body: `{ "chatInput": string, "sessionId": string }`
- `POST /webhook/BsryWt8HYdCsVN46/webhook/data-ingestion` — Ingest artworks. Body: `{ "artworks": Artwork[], "enableVision": boolean }`
- `POST /webhook/61VAJ3acwD4guNB1/webhook/qdrant-search-helper` — Internal vector search helper. Body: `{ "query": string, "limit": number }`
- `POST /webhook/mrBvmL4wIUlZIGtY/webhook/curator-helper` — Internal curator operations helper

## Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # TypeScript check + Vite production build
npm run preview      # Preview production build locally
npm run lint         # ESLint check

# Deploy to production
npm run build && aws s3 sync dist/ s3://www.geuse.io/curator/ --delete --exclude "artwork-cache/*"

# Data ingestion (requires .venv)
source .venv/bin/activate
python scripts/data_ingestion_pipeline.py --limit 100 --batch-size 10 --cache-thumbnails-s3

# Refresh cached frontend thumbnails in S3 on ingestion
python scripts/data_ingestion_pipeline.py --limit 1000 --batch-size 20 --cache-thumbnails-s3
```

## Key Architecture Decisions

**Frontend data flow:** `useSearch` hook calls `searchArtworks()` → `apiPost()` → n8n webhook → Qdrant vector search → formatted results. The `Artwork` type expects an `images[]` array, but the API returns `iiifthumburl` at the result root level too, so `ArtworkCard` checks both paths.

**Home page freshness:** "Today's Art Highlight" uses semantic search ("masterpiece paintings") with a date-seeded shuffle on the top 15 results so the 5 shown vary daily. "Check out more" calls `searchNewestArtworks()` (Postgres `ORDER BY last_ingested_at DESC`); if that endpoint is not deployed, it falls back to semantic search ("recent art collection").

**IIIF image URLs:** NGA thumbnails use `!200,200` sizing. `ArtworkCard` upgrades these to `!600,600` via `getHighResUrl()` for high-res display. Full-size images use the `iiifurl` field without size constraints.

**n8n workflow pattern:** Both search and curator can use HTTP delegation to helper workflows to stay within memory limits.

Important: In production, avoid hardcoding `localhost:5678` inside workflows unless the helper is guaranteed to be on the same host/container network. Prefer calling the public base URL (`https://ai.geuse.io`) and use each webhook node's current production URL. On this n8n `2.7.5` instance, production routes are currently registered as `/webhook/<workflowId>/webhook/<path>`.

**Vite base path:** Set to `/curator/` in `vite.config.ts` for S3 subdirectory deployment. All asset paths are relative to this base.

## Design System — Liquid Glass

All styling uses Tailwind utility classes (no CSS modules). The theme is defined in `src/index.css` via `@theme`:

- Backgrounds: `bg-surface-dark` (#0a0a0a), `bg-surface-card` (#141414), `bg-glass-white` (rgba white 12%)
- Text: `text-text-primary` (#f5f5f5), `text-text-secondary` (#a0a0a0)
- Accent: `bg-accent` (#8b5cf6 purple), `shadow-accent-glow`
- Glass effect: combine `backdrop-blur-xl` + `bg-glass-white` + `border-glass-border`
- Responsive breakpoints: `sm:` (640px), `lg:` (1024px), `xl:` (1280px) — no `xs:` prefix

## Conventions

- TypeScript strict mode with `verbatimModuleSyntax` — use `import type` for type-only imports
- Components in `src/components/` with PascalCase filenames, functional components only
- Hooks in `src/hooks/` with `use` prefix, `useCallback` for memoized functions
- API calls in `src/api/` — generic `apiPost<T>()` wrapper in `client.ts`
- Types in `src/types/` — all API request/response shapes defined here
- Tailwind for all styling, no CSS modules or styled-components
- Accessibility: ARIA labels, focus traps in modals, `sr-only` for screen readers, `aria-live` for dynamic content
- Environment variables prefixed with `VITE_` and accessed via `import.meta.env`
