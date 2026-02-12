import { apiPost } from './client'
import type { CollectionResponse, SearchRequest, SearchResponse } from '../types/artwork'

const SEARCH_ENDPOINT = import.meta.env.VITE_SEARCH_ENDPOINT || '/webhook/art-search-chat/chat'
const NEWEST_ENDPOINT = import.meta.env.VITE_NEWEST_ENDPOINT || '/webhook/home-newest'
const DISCOVER_ENDPOINT = import.meta.env.VITE_DISCOVER_ENDPOINT || NEWEST_ENDPOINT

interface SearchOptions {
  sessionId?: string
  signal?: AbortSignal
}

interface CollectionOptions {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

export async function searchArtworks(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
  const payload: SearchRequest = {
    chatInput: query,
    sessionId: options.sessionId,
  }

  return apiPost<SearchResponse>(SEARCH_ENDPOINT, payload, { signal: options.signal })
}

/**
 * Fetch artworks ordered by last_ingested_at (newest first).
 * Falls back to semantic search if the endpoint is not yet deployed.
 */
export async function searchNewestArtworks(options: CollectionOptions = {}): Promise<CollectionResponse> {
  const body: Record<string, number> = {}
  if (typeof options.limit === 'number') body.limit = options.limit
  if (typeof options.offset === 'number') body.offset = options.offset
  return apiPost<CollectionResponse>(NEWEST_ENDPOINT, body, { signal: options.signal })
}

/**
 * Fetch a discover page intended for exhaustive scrolling through the collection.
 * By default, this reuses the newest endpoint unless VITE_DISCOVER_ENDPOINT is set.
 */
export async function discoverArtworksPage(options: CollectionOptions = {}): Promise<CollectionResponse> {
  const body: Record<string, number> = {}
  if (typeof options.limit === 'number') body.limit = options.limit
  if (typeof options.offset === 'number') body.offset = options.offset
  return apiPost<CollectionResponse>(DISCOVER_ENDPOINT, body, { signal: options.signal })
}
