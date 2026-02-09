import { apiPost } from './client'
import type { SearchRequest, SearchResponse } from '../types/artwork'

const SEARCH_ENDPOINT = import.meta.env.VITE_SEARCH_ENDPOINT || '/webhook/art-search-chat/chat'
const NEWEST_ENDPOINT = import.meta.env.VITE_NEWEST_ENDPOINT || '/webhook/home-newest'

interface SearchOptions {
  sessionId?: string
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
export async function searchNewestArtworks(options: SearchOptions = {}): Promise<SearchResponse> {
  return apiPost<SearchResponse>(NEWEST_ENDPOINT, {}, { signal: options.signal })
}
